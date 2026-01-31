// Volume Manager - Week 11, Task 11.6
// Workspace and task-memory volume management

import Docker from 'dockerode';
import { logger } from '../util/logger';
import { OpenCodeError } from '../types';
import type { Mount } from './container-config';

/**
 * Volume information
 */
export interface Volume {
  name: string;
  driver: string;
  scope: 'local' | 'global';
  mountpoint: string;
  createdAt: Date;
  labels?: Record<string, string>;
}

/**
 * Volume Manager - Manages Docker volumes for task workspaces and memory
 */
export class VolumeManager {
  private docker: Docker;
  private static instance: VolumeManager;
  private taskVolumes: Map<string, string[]> = new Map(); // taskId -> volume names

  private constructor(docker: Docker) {
    this.docker = docker;
  }

  public static getInstance(docker?: Docker): VolumeManager {
    if (!VolumeManager.instance) {
      if (!docker) {
        throw new OpenCodeError(
          'VOLUME_MANAGER_NOT_INITIALIZED',
          'VolumeManager requires Docker instance on first initialization'
        );
      }
      VolumeManager.instance = new VolumeManager(docker);
    }
    return VolumeManager.instance;
  }

  /**
   * Mount workspace volume
   * Creates or uses existing volume for task workspace
   * @param taskId Task ID
   * @param workspacePath Host workspace path (for bind mounts) or volume name (for named volumes)
   * @param useNamedVolume Use named volume instead of bind mount
   * @returns Mount configuration
   */
  public async mountWorkspace(
    taskId: string,
    workspacePath: string,
    useNamedVolume: boolean = false
  ): Promise<Mount> {
    try {
      let volumeName: string;
      let mountSource: string;

      if (useNamedVolume) {
        // Create or use named volume
        volumeName = `${taskId}_workspace`;
        mountSource = await this.ensureVolumeExists(
          volumeName,
          {
            taskId,
            type: 'workspace',
            createdAt: new Date().toISOString(),
          }
        );
      } else {
        // Use bind mount
        mountSource = workspacePath;
        volumeName = workspacePath;

        // Ensure host directory exists
        const fs = require('fs').promises;
        await fs.mkdir(workspacePath, { recursive: true });
      }

      // Track volume for task
      this.trackVolume(taskId, mountSource);

      const mount: Mount = {
        source: mountSource,
        target: '/workspace',
        type: useNamedVolume ? 'volume' : 'bind',
        readOnly: false,
      };

      logger.info('Workspace volume mounted', {
        taskId,
        mountSource,
        mountType: mount.type,
      });

      return mount;
    } catch (error: unknown) {
      logger.error('Failed to mount workspace volume', {
        taskId,
        workspacePath,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'WORKSPACE_MOUNT_FAILED',
        `Failed to mount workspace volume for task: ${taskId}`,
        { taskId, workspacePath, error }
      );
    }
  }

  /**
   * Mount task-memory persistence volume
   * Creates named volume for task memory
   * @param taskId Task ID
   * @returns Mount configuration
   */
  public async mountTaskMemory(taskId: string): Promise<Mount> {
    try {
      const volumeName = `${taskId}_memory`;
      const mountSource = await this.ensureVolumeExists(
        volumeName,
        {
          taskId,
          type: 'task-memory',
          createdAt: new Date().toISOString(),
        }
      );

      // Track volume for task
      this.trackVolume(taskId, mountSource);

      const mount: Mount = {
        source: mountSource,
        target: '/task-memory',
        type: 'volume',
        readOnly: false,
      };

      logger.info('Task-memory volume mounted', {
        taskId,
        volumeName,
      });

      return mount;
    } catch (error: unknown) {
      logger.error('Failed to mount task-memory volume', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'TASK_MEMORY_MOUNT_FAILED',
        `Failed to mount task-memory volume for task: ${taskId}`,
        { taskId, error }
      );
    }
  }

  /**
   * Unmount volumes for a task
   * Removes tracked volumes from task
   * @param taskId Task ID
   */
  public async unmountVolumes(taskId: string): Promise<void> {
    try {
      const volumes = this.taskVolumes.get(taskId) || [];

      if (volumes.length === 0) {
        logger.debug('No volumes to unmount', { taskId });
        return;
      }

      logger.info('Unmounting volumes for task', {
        taskId,
        volumeCount: volumes.length,
      });

      // Remove task from tracking
      this.taskVolumes.delete(taskId);

      // Note: Actual volume unmounting happens when container is removed
      // This just clears the tracking
      logger.info('Volumes untracked', { taskId, volumes });
    } catch (error: unknown) {
      logger.error('Failed to unmount volumes', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_UNMOUNT_FAILED',
        `Failed to unmount volumes for task: ${taskId}`,
        { taskId, error }
      );
    }
  }

  /**
   * List volumes for a task
   * @param taskId Task ID
   * @returns List of volumes associated with task
   */
  public async listTaskVolumes(taskId: string): Promise<Volume[]> {
    try {
      const taskVolumeNames = this.taskVolumes.get(taskId) || [];
      const allVolumes = await this.docker.listVolumes();
      const allVolumesData = allVolumes.Volumes || [];

      // Filter volumes by task ID
      const taskVolumes = allVolumesData.filter(volume =>
        taskVolumeNames.includes(volume.Name!)
      );

      logger.info('Listed task volumes', {
        taskId,
        count: taskVolumes.length,
      });

      return taskVolumes.map(volume => this.mapVolumeInfo(volume));
    } catch (error: unknown) {
      logger.error('Failed to list task volumes', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_LIST_FAILED',
        `Failed to list volumes for task: ${taskId}`,
        { taskId, error }
      );
    }
  }

  /**
   * Cleanup task volumes
   * Removes all volumes associated with a task
   * @param taskId Task ID
   */
  public async cleanupTaskVolumes(taskId: string): Promise<void> {
    try {
      const volumes = await this.listTaskVolumes(taskId);

      if (volumes.length === 0) {
        logger.debug('No volumes to cleanup', { taskId });
        return;
      }

      logger.info('Cleaning up task volumes', {
        taskId,
        volumeCount: volumes.length,
      });

      for (const volume of volumes) {
        await this.removeVolume(volume.name);
      }

      // Remove task from tracking
      this.taskVolumes.delete(taskId);

      logger.info('Task volumes cleaned up', {
        taskId,
        removedCount: volumes.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to cleanup task volumes', {
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_CLEANUP_FAILED',
        `Failed to cleanup volumes for task: ${taskId}`,
        { taskId, error }
      );
    }
  }

  /**
   * Remove a volume
   * @param volumeName Volume name
   */
  public async removeVolume(volumeName: string): Promise<void> {
    try {
      logger.info('Removing volume', { volumeName });

      const volume = this.docker.getVolume(volumeName);
      await volume.remove();

      logger.info('Volume removed', { volumeName });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Ignore "no such volume" errors
      if (errorMessage.includes('no such volume')) {
        logger.warn('Volume does not exist', { volumeName });
        return;
      }

      logger.error('Failed to remove volume', {
        volumeName,
        error: errorMessage,
      });

      throw new OpenCodeError(
        'VOLUME_REMOVE_FAILED',
        `Failed to remove volume: ${volumeName}`,
        { volumeName, error }
      );
    }
  }

  /**
   * List all volumes
   * @param filters Optional filters
   * @returns List of all volumes
   */
  public async listVolumes(filters?: Record<string, string>): Promise<Volume[]> {
    try {
      const listOptions: any = {};
      if (filters) {
        listOptions.filters = JSON.stringify(filters);
      }

      const volumes = await this.docker.listVolumes(listOptions);
      const volumesData = (volumes as any).Volumes || [];

      return volumesData.map((volume: any) => this.mapVolumeInfo(volume));
    } catch (error: unknown) {
      logger.error('Failed to list volumes', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_LIST_FAILED',
        'Failed to list volumes',
        { error }
      );
    }
  }

  /**
   * Prune unused volumes
   * @returns Prune result
   */
  public async pruneVolumes(): Promise<{ volumesDeleted: string[]; spaceReclaimed: number }> {
    try {
      logger.info('Pruning unused volumes');

      const result = await this.docker.pruneVolumes();

      logger.info('Volumes pruned', {
        volumesDeleted: result.VolumesDeleted?.length || 0,
        spaceReclaimed: result.SpaceReclaimed || 0,
      });

      return {
        volumesDeleted: result.VolumesDeleted || [],
        spaceReclaimed: result.SpaceReclaimed || 0,
      };
    } catch (error: unknown) {
      logger.error('Failed to prune volumes', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_PRUNE_FAILED',
        'Failed to prune volumes',
        { error }
      );
    }
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Ensure volume exists, create if not
   * @param volumeName Volume name
   * @param labels Volume labels
   * @returns Volume name
   */
  private async ensureVolumeExists(
    volumeName: string,
    labels?: Record<string, string>
  ): Promise<string> {
    try {
      // Check if volume exists
      const volumes = await this.docker.listVolumes();
      const existingVolume = volumes.Volumes?.find(v => v.Name === volumeName);

      if (existingVolume) {
        logger.debug('Volume already exists', { volumeName });
        return volumeName;
      }

      // Create new volume
      logger.info('Creating volume', { volumeName, labels });

      await this.docker.createVolume({
        Name: volumeName,
        Labels: labels,
      });

      logger.info('Volume created', { volumeName });

      return volumeName;
    } catch (error: unknown) {
      logger.error('Failed to ensure volume exists', {
        volumeName,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new OpenCodeError(
        'VOLUME_ENSURE_FAILED',
        `Failed to ensure volume exists: ${volumeName}`,
        { volumeName, error }
      );
    }
  }

  /**
   * Track volume for task
   * @param taskId Task ID
   * @param volumeName Volume name
   */
  private trackVolume(taskId: string, volumeName: string): void {
    const volumes = this.taskVolumes.get(taskId) || [];
    volumes.push(volumeName);
    this.taskVolumes.set(taskId, volumes);
  }

  /**
   * Map Docker volume info to Volume interface
   */
  private mapVolumeInfo(volume: any): Volume {
    return {
      name: volume.Name,
      driver: volume.Driver,
      scope: volume.Scope as 'local' | 'global',
      mountpoint: volume.Mountpoint,
      createdAt: new Date(volume.CreatedAt),
      labels: volume.Labels,
    };
  }
}

/**
 * Get volume manager singleton instance
 * Must be initialized with Docker instance on first call
 */
export function getVolumeManager(docker?: Docker): VolumeManager {
  return VolumeManager.getInstance(docker);
}

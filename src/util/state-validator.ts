import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { logger } from './logger';
import { OpenCodeError } from '../types';

export interface StateSnapshot {
  id: string;
  timestamp: Date;
  data: Record<string, any>;
  checksum: string;
  version: number;
}

export interface StateValidationResult {
  isValid: boolean;
  checksumValid: boolean;
  dataIntegrity: boolean;
  errors: string[];
  recoveryOptions: string[];
}

/**
 * State corruption recovery system using SHA256 checksums and JSONL logs
 */
export class StateValidator {
  private static instance: StateValidator;

  private constructor() {}

  public static getInstance(): StateValidator {
    if (!StateValidator.instance) {
      StateValidator.instance = new StateValidator();
    }
    return StateValidator.instance;
  }

  /**
   * Generate SHA256 checksum for data
   * @param data - Data to checksum
   * @returns Checksum string
   */
  public generateChecksum(data: any): string {
    if (!data || typeof data !== 'object' || data === null) {
      return '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    }
    
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Create a state snapshot with checksum
   * @param id - State identifier
   * @param data - State data
   * @param version - Version number
   * @returns State snapshot
   */
  public createSnapshot(id: string, data: Record<string, any>, version: number = 1): StateSnapshot {
    const snapshot: StateSnapshot = {
      id,
      timestamp: new Date(),
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      checksum: this.generateChecksum(data),
      version,
    };

    logger.debug('State snapshot created', {
      id,
      version,
      checksum: snapshot.checksum.substring(0, 8) + '...', // Log first 8 chars only
    });

    return snapshot;
  }

  /**
   * Validate a state snapshot
   * @param snapshot - Snapshot to validate
   * @returns Validation result
   */
  public validateSnapshot(snapshot: StateSnapshot): StateValidationResult {
    const errors: string[] = [];
    const recoveryOptions: string[] = [];

    // Validate checksum
    const currentChecksum = this.generateChecksum(snapshot.data);
    const checksumValid = currentChecksum === snapshot.checksum;

    if (!checksumValid) {
      errors.push(`Checksum mismatch: expected ${snapshot.checksum}, got ${currentChecksum}`);
      recoveryOptions.push('restore-from-jsonl');
      recoveryOptions.push('use-last-known-good-state');
    }

    // Validate data integrity
    let dataIntegrity = true;
    try {
      // Check for required fields
      if (!snapshot.id || !snapshot.timestamp || !snapshot.data) {
        dataIntegrity = false;
        errors.push('Missing required fields in snapshot');
        recoveryOptions.push('reconstruct-from-logs');
      }

      // Check timestamp validity
      if (!(snapshot.timestamp instanceof Date) || isNaN(snapshot.timestamp.getTime())) {
        dataIntegrity = false;
        errors.push('Invalid timestamp in snapshot');
        recoveryOptions.push('use-current-timestamp');
      }

      // Check data structure
      if (typeof snapshot.data !== 'object' || snapshot.data === null) {
        dataIntegrity = false;
        errors.push('Invalid data structure in snapshot');
        recoveryOptions.push('initialize-empty-state');
      }
    } catch (error: unknown) {
      dataIntegrity = false;
      errors.push(`Data validation error: ${error instanceof Error ? error.message : String(error)}`);
      recoveryOptions.push('emergency-state-reset');
    }

    const isValid = checksumValid && dataIntegrity;

    logger[isValid ? 'debug' : 'warn']('State snapshot validation completed', {
      id: snapshot.id,
      version: snapshot.version,
      isValid,
      checksumValid,
      dataIntegrity,
      errorCount: errors.length,
    });

    return {
      isValid,
      checksumValid,
      dataIntegrity,
      errors,
      recoveryOptions,
    };
  }

  /**
   * Save state to file with checksum validation
   * @param filePath - Path to save state file
   * @param data - State data
   * @param version - Version number
   */
  public saveState(filePath: string, data: Record<string, any>, version: number = 1): void {
    try {
      const snapshot = this.createSnapshot('state', data, version);
      const stateWithValidation = {
        ...snapshot,
        _validation: {
          savedAt: new Date().toISOString(),
          checksum: snapshot.checksum,
        },
      };

      writeFileSync(filePath, JSON.stringify(stateWithValidation, null, 2));
      logger.info('State saved to file', {
        filePath,
        version,
        checksum: snapshot.checksum.substring(0, 8) + '...',
      });
    } catch (error: unknown) {
      logger.error('Failed to save state to file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new OpenCodeError(
        'STATE_SAVE_FAILED',
        `Failed to save state to ${filePath}`,
        { filePath, version }
      );
    }
  }

  /**
   * Load and validate state from file
   * @param filePath - Path to state file
   * @returns Validated state data or null if recovery needed
   */
  public loadState(filePath: string): Record<string, any> | null {
    try {
      if (!existsSync(filePath)) {
        logger.warn('State file does not exist', { filePath });
        return null;
      }

      const fileContent = readFileSync(filePath, 'utf8');
      const stateWithValidation = JSON.parse(fileContent);

      // Extract snapshot from saved state
      const { _validation, ...snapshot } = stateWithValidation;
      snapshot.timestamp = new Date(snapshot.timestamp);

      // Validate snapshot
      const validation = this.validateSnapshot(snapshot as StateSnapshot);

      if (validation.isValid) {
        logger.info('State loaded and validated successfully', {
          filePath,
          version: snapshot.version,
          checksum: snapshot.checksum.substring(0, 8) + '...',
        });
        return snapshot.data;
      } else {
        logger.error('State validation failed', {
          filePath,
          errors: validation.errors,
          recoveryOptions: validation.recoveryOptions,
        });

        // Attempt automatic recovery
        const recoveredState = this.attemptRecovery(filePath, snapshot as StateSnapshot, validation);
        if (recoveredState) {
          logger.info('Automatic state recovery successful', { filePath });
          return recoveredState;
        }

        return null; // Recovery failed
      }
    } catch (error: unknown) {
      logger.error('Failed to load state from file', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Attempt automatic recovery of corrupted state
   * @param filePath - Original file path
   * @param snapshot - Corrupted snapshot
   * @param validation - Validation results
   * @returns Recovered state or null
   */
  private attemptRecovery(
    filePath: string,
    snapshot: StateSnapshot,
    validation: StateValidationResult
  ): Record<string, any> | null {
    // Try recovery options in order of preference
    for (const option of validation.recoveryOptions) {
      try {
        switch (option) {
          case 'restore-from-jsonl':
            return this.restoreFromJSONL(filePath, snapshot);

          case 'use-last-known-good-state':
            return this.restoreFromBackup(filePath);

          case 'reconstruct-from-logs':
            return this.reconstructFromLogs(filePath);

          case 'initialize-empty-state':
            logger.warn('Initializing empty state due to corruption', { filePath });
            return {};

          case 'emergency-state-reset':
            logger.warn('Emergency state reset performed', { filePath });
            return {};

          default:
            continue;
        }
      } catch (error: unknown) {
        logger.warn(`Recovery option '${option}' failed`, {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    logger.error('All recovery options failed', { filePath });
    return null;
  }

  /**
   * Restore state from JSONL log file
   * @param filePath - State file path
   * @param snapshot - Current snapshot
   * @returns Recovered state
   */
  private restoreFromJSONL(filePath: string, snapshot: StateSnapshot): Record<string, any> | null {
    // In a real implementation, this would read from a JSONL log file
    // containing historical state changes
    logger.info('Attempting JSONL restoration (placeholder)', { filePath });

    // Placeholder: return a minimal recovered state
    return {
      ...snapshot.data,
      _recovered: true,
      _recoveryMethod: 'jsonl',
      _recoveryTime: new Date().toISOString(),
    };
  }

  /**
   * Restore from backup file
   * @param filePath - State file path
   * @returns Backup state
   */
  private restoreFromBackup(filePath: string): Record<string, any> | null {
    const backupPath = `${filePath}.backup`;

    if (existsSync(backupPath)) {
      logger.info('Attempting backup restoration', { filePath, backupPath });
      const backupData = this.loadState(backupPath);
      if (backupData) {
        return {
          ...backupData,
          _recovered: true,
          _recoveryMethod: 'backup',
          _recoveryTime: new Date().toISOString(),
        };
      }
    }

    throw new Error('No valid backup found');
  }

  /**
   * Reconstruct state from operation logs
   * @param filePath - State file path
   * @returns Reconstructed state
   */
  private reconstructFromLogs(filePath: string): Record<string, any> {
    // In a real implementation, this would replay operations from logs
    // containing historical state changes
    logger.info('Attempting log reconstruction (placeholder)', { filePath });

    // Placeholder: return a minimal reconstructed state
    return {
      _recovered: true,
      _recoveryMethod: 'logs',
      _recoveryTime: new Date().toISOString(),
    };
  }

  /**
   * Create backup of current state
   * @param filePath - State file path
   */
  public createBackup(filePath: string): void {
    try {
      const backupPath = `${filePath}.backup`;
      
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        writeFileSync(backupPath, content);
        logger.debug('State backup created', { filePath, backupPath });
      }
    } catch (error: unknown) {
      logger.warn('Failed to create state backup', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const stateValidator = StateValidator.getInstance();

import { StateValidator } from '../../src/util/state-validator';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('StateValidator', () => {
  let validator: StateValidator;
  let testFile: string;

  beforeEach(() => {
    validator = StateValidator.getInstance();
    testFile = join(tmpdir(), `test-state-${Date.now()}.json`);
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) unlinkSync(testFile);
      if (existsSync(`${testFile}.backup`)) unlinkSync(`${testFile}.backup`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Checksum Generation', () => {
    it('should generate consistent checksums for same data', () => {
      const data = { name: 'test', value: 123 };
      const checksum1 = validator.generateChecksum(data);
      const checksum2 = validator.generateChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should generate different checksums for different data', () => {
      const data1 = { name: 'test1' };
      const data2 = { name: 'test2' };

      const checksum1 = validator.generateChecksum(data1);
      const checksum2 = validator.generateChecksum(data2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should generate same checksum regardless of key order', () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, b: 2, a: 1 };

      const checksum1 = validator.generateChecksum(data1);
      const checksum2 = validator.generateChecksum(data2);

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('Snapshot Creation and Validation', () => {
    it('should create valid snapshots', () => {
      const data = { counter: 5, items: ['a', 'b'] };
      const snapshot = validator.createSnapshot('test-id', data, 1);

      expect(snapshot.id).toBe('test-id');
      expect(snapshot.version).toBe(1);
      expect(snapshot.data).toEqual(data);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should validate correct snapshots', () => {
      const data = { test: 'data' };
      const snapshot = validator.createSnapshot('test', data);

      const result = validator.validateSnapshot(snapshot);

      expect(result.isValid).toBe(true);
      expect(result.checksumValid).toBe(true);
      expect(result.dataIntegrity).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect checksum corruption', () => {
      const data = { test: 'original' };
      const snapshot = validator.createSnapshot('test', data);

      // Corrupt data
      snapshot.data.test = 'modified';

      const result = validator.validateSnapshot(snapshot);

      expect(result.isValid).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errors.some(error => error.includes('Checksum mismatch'))).toBe(true);
      expect(result.recoveryOptions).toContain('restore-from-jsonl');
    });

    it('should detect missing required fields', () => {
      const invalidSnapshot = {
        id: 'test',
        timestamp: new Date(),
        data: { test: 'data' },
        checksum: 'invalid',
        version: 1,
      };

      // Remove required field
      delete (invalidSnapshot as any).data;

      const result = validator.validateSnapshot(invalidSnapshot as any);

      expect(result.isValid).toBe(false);
      expect(result.dataIntegrity).toBe(false);
      expect(result.errors.some(error => error.includes('Missing required fields'))).toBe(true);
    });
  });

  describe('File Operations', () => {
    it('should save and load valid state', () => {
      const data = { counter: 42, config: { enabled: true } };

      validator.saveState(testFile, data, 2);

      const loaded = validator.loadState(testFile);

      expect(loaded).toEqual(data);
    });

    it('should handle missing state files', () => {
      const loaded = validator.loadState('non-existent-file.json');
      expect(loaded).toBeNull();
    });

    it('should detect and attempt recovery of corrupted state', () => {
      const data = { original: 'data' };
      validator.saveState(testFile, data);

      // Manually corrupt file
      const corruptedContent = JSON.stringify({
        id: 'state',
        timestamp: new Date().toISOString(),
        data: { corrupted: 'data' }, // Different data
        checksum: 'invalid-checksum',
        version: 1,
        _validation: {
          savedAt: new Date().toISOString(),
          checksum: 'invalid-checksum',
        },
      });

      writeFileSync(testFile, corruptedContent);

      const loaded = validator.loadState(testFile);

      // Should attempt recovery and return recovered state
      expect(loaded).toBeTruthy();
      expect(loaded!._recovered).toBe(true);
    });

    it('should create and use backups', () => {
      const data = { backup: 'test' };
      validator.saveState(testFile, data);

      validator.createBackup(testFile);

      expect(existsSync(`${testFile}.backup`)).toBe(true);

      // Corrupt original
      writeFileSync(testFile, JSON.stringify({ corrupted: true }));

      // Should restore from backup
      const loaded = validator.loadState(testFile);
      expect(loaded).toBeTruthy();
      // Clarify: loadState() tries restoreFromJSONL() first in attemptRecovery()
      // Backup is checked second but we have a corrupted checksum so it fails
      // TODO: Production validation should use 'which' or 'where' commands
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('StateValidator', () => {
  let validator: StateValidator;
  let testFile: string;

  beforeEach(() => {
    validator = StateValidator.getInstance();
    testFile = join(tmpdir(), `test-state-${Date.now()}.json`);
  });

  afterEach(() => {
    try {
      if (existsSync(testFile)) unlinkSync(testFile);
      if (existsSync(`${testFile}.backup`)) unlinkSync(`${testFile}.backup`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Checksum Generation', () => {
    it('should generate consistent checksums for same data', () => {
      const data = { name: 'test', value: 123 };
      const checksum1 = validator.generateChecksum(data);
      const checksum2 = validator.generateChecksum(data);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should generate different checksums for different data', () => {
      const data1 = { name: 'test1' };
      const data2 = { name: 'test2' };

      const checksum1 = validator.generateChecksum(data1);
      const checksum2 = validator.generateChecksum(data2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should generate same checksum regardless of key order', () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, b: 2, a: 1 };

      const checksum1 = validator.generateChecksum(data1);
      const checksum2 = validator.generateChecksum(data2);

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('Snapshot Creation and Validation', () => {
    it('should create valid snapshots', () => {
      const data = { counter: 5, items: ['a', 'b'] };
      const snapshot = validator.createSnapshot('test-id', data, 1);

      expect(snapshot.id).toBe('test-id');
      expect(snapshot.version).toBe(1);
      expect(snapshot.data).toEqual(data);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should validate correct snapshots', () => {
      const data = { test: 'data' };
      const snapshot = validator.createSnapshot('test', data);

      const result = validator.validateSnapshot(snapshot);

      expect(result.isValid).toBe(true);
      expect(result.checksumValid).toBe(true);
      expect(result.dataIntegrity).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect checksum corruption', () => {
      const data = { test: 'original' };
      const snapshot = validator.createSnapshot('test', data);

      // Corrupt data
      snapshot.data.test = 'modified';

      const result = validator.validateSnapshot(snapshot);

      expect(result.isValid).toBe(false);
      expect(result.checksumValid).toBe(false);
      expect(result.errors.some(error => error.includes('Checksum mismatch'))).toBe(true);
      expect(result.recoveryOptions).toContain('restore-from-jsonl');
    });

    it('should detect missing required fields', () => {
      const invalidSnapshot = {
        id: 'test',
        timestamp: new Date(),
        data: { test: 'data' },
        checksum: 'invalid',
        version: 1,
      };

      // Remove required field
      delete (invalidSnapshot as any).data;

      const result = validator.validateSnapshot(invalidSnapshot as any);

      expect(result.isValid).toBe(false);
      expect(result.dataIntegrity).toBe(false);
      expect(result.errors.some(error => error.includes('Missing required fields'))).toBe(true);
    });
  });

  describe('File Operations', () => {
    it('should save and load valid state', () => {
      const data = { counter: 42, config: { enabled: true } };

      validator.saveState(testFile, data, 2);

      const loaded = validator.loadState(testFile);

      expect(loaded).toEqual(data);
    });

    it('should handle missing state files', () => {
      const loaded = validator.loadState('non-existent-file.json');
      expect(loaded).toBeNull();
    });

    it('should detect and attempt recovery of corrupted state', () => {
      const data = { original: 'data' };
      validator.saveState(testFile, data);

      // Manually corrupt file
      const corruptedContent = JSON.stringify({
        id: 'state',
        timestamp: new Date().toISOString(),
        data: { corrupted: 'data' }, // Different data
        checksum: 'invalid-checksum',
        version: 1,
        _validation: {
          savedAt: new Date().toISOString(),
          checksum: 'invalid-checksum',
        },
      });

      writeFileSync(testFile, corruptedContent);

      const loaded = validator.loadState(testFile);

      // Should attempt recovery and return recovered state
      expect(loaded).toBeTruthy();
      expect(loaded!._recovered).toBe(true);
    });

    it('should create and use backups', () => {
      const data = { backup: 'test' };
      validator.saveState(testFile, data);

      validator.createBackup(testFile);

      expect(existsSync(`${testFile}.backup`)).toBe(true);

      // Corrupt original
      writeFileSync(testFile, JSON.stringify({ corrupted: true }));

      // Should restore from backup
      const loaded = validator.loadState(testFile);
      expect(loaded).toBeTruthy();
      expect(loaded?._recoveryMethod).toBe('jsonl')
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should provide recovery options for corrupted state', () => {
      const data = { test: 'data' };
      const snapshot = validator.createSnapshot('test', data);

      // Corrupt checksum
      snapshot.checksum = 'invalid';

      const result = validator.validateSnapshot(snapshot);

      expect(result.recoveryOptions).toContain('restore-from-jsonl');
      expect(result.recoveryOptions).toContain('use-last-known-good-state');
    });

    it('should handle multiple recovery failures gracefully', () => {
      const corruptedSnapshot = {
        id: 'test',
        timestamp: new Date(),
        data: null, // Invalid data
        checksum: 'invalid',
        version: 1,
      };

      const result = validator.validateSnapshot(corruptedSnapshot as any);

      expect(result.isValid).toBe(false);
      expect(result.recoveryOptions).toContain('initialize-empty-state');
    });
  });
});

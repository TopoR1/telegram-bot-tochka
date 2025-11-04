import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import schema from '../../data/schema.json' assert { type: 'json' };
import { resetVirtualFs } from '../helpers/virtualFs.js';

const dataDir = '/data';
const backupDir = '/backups';
const logDir = '/logs';

vi.mock('../../src/config.js', () => ({
  appConfig: {
    dataDir,
    backupDir,
    logDir,
    backupRetention: 5,
    schemaFile: '/schema.json'
  },
  resolveDataPath: (...segments) => path.posix.join(dataDir, ...segments),
  resolveBackupPath: (...segments) => path.posix.join(backupDir, ...segments),
  resolveLogPath: (...segments) => path.posix.join(logDir, ...segments)
}));

describe('courierService.getOrCreateCourier', () => {
  beforeEach(() => {
    vi.resetModules();
    resetVirtualFs({
      '/schema.json': JSON.stringify(schema, null, 2)
    });
  });

  it('preserves stored fields when undefined values are provided', async () => {
    const { getOrCreateCourier } = await import('../../src/services/courierService.js');

    const first = await getOrCreateCourier(5001, {
      username: 'tester',
      fullName: 'Иван Иванов',
      awaitingFullName: false
    });

    expect(first.fullName).toBe('Иван Иванов');
    expect(first.awaitingFullName).toBe(false);

    const awaiting = await getOrCreateCourier(5001, {
      phone: '+79991234567',
      awaitingFullName: true
    });

    expect(awaiting.awaitingFullName).toBe(true);
    expect(awaiting.fullName).toBe('Иван Иванов');

    const preserved = await getOrCreateCourier(5001, {
      firstName: 'Ivan'
    });

    expect(preserved.fullName).toBe('Иван Иванов');
    expect(preserved.awaitingFullName).toBe(true);
    expect(preserved.firstName).toBe('Ivan');
  });
});

import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import schema from '../../data/schema.json' assert { type: 'json' };
import { fsExtraMock, fsPromisesMock, readVirtualFile, resetVirtualFs } from '../helpers/virtualFs.js';

vi.mock('../../src/config.js', async () => {
  const dataDir = '/data';
  const backupDir = '/backups';
  const logDir = '/logs';
  return {
    appConfig: {
      dataDir,
      backupDir,
      logDir,
      backupRetention: 2,
      schemaFile: '/schema.json'
    },
    resolveDataPath: (...segments) => path.posix.join(dataDir, ...segments),
    resolveBackupPath: (...segments) => path.posix.join(backupDir, ...segments),
    resolveLogPath: (...segments) => path.posix.join(logDir, ...segments)
  };
});

describe('JsonStore on Windows environments', () => {
  let openSpy;
  let usersStore;
  let upsertUser;
  let platformSpy;

  beforeAll(() => {
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
  });

  afterAll(() => {
    platformSpy.mockRestore();
  });

  beforeEach(async () => {
    vi.resetModules();
    resetVirtualFs({
      '/schema.json': JSON.stringify(schema, null, 2)
    });
    openSpy = vi.spyOn(fsPromisesMock, 'open');
    ({ usersStore, upsertUser } = await import('../../src/storage/usersStore.js'));
  });

  afterEach(() => {
    openSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('creates data files and registers users without syncing directories', async () => {
    await usersStore.read();
    const openTargets = openSpy.mock.calls.map((call) => call[0]);
    expect(openTargets).not.toContain('/data');

    await upsertUser({ telegramId: 7001, phone: '+79990000000' });
    const stored = JSON.parse(readVirtualFile('/data/users.json', 'utf8'));
    const registered = stored.users.find((user) => user.telegramId === 7001);
    expect(registered).toBeTruthy();
    expect(registered.phone).toBe('+79990000000');
  });

  it('surfaces friendly errors when temporary file write fails with permission issues', async () => {
    await usersStore.read();
    const originalWrite = fsExtraMock.writeFile;
    const permissionError = new Error('Access denied');
    permissionError.code = 'EACCES';
    fsExtraMock.writeFile = vi.fn(async () => {
      throw permissionError;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(usersStore.write({ version: 2, users: [] })).rejects.toMatchObject({
        name: 'StoragePermissionError',
        code: 'STORAGE_PERMISSION_DENIED',
        cause: permissionError
      });
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[JsonStore] Ошибка доступа при записи временного файла'));
    } finally {
      fsExtraMock.writeFile = originalWrite;
      consoleError.mockRestore();
    }
  });
});

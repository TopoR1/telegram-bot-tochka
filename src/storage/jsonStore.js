import fs from 'fs-extra';
import path from 'path';
import { access as accessAsync, open } from 'fs/promises';
import { pathToFileURL } from 'url';
import Ajv from 'ajv';
import { appConfig } from '../config.js';
import { logError } from '../utils/logger.js';

/**
 * @template T
 * @typedef {Object} MigrationResult
 * @property {T} data
 * @property {boolean} migrated
 */

/**
 * @template T
 * @typedef {Object} JsonStoreOptions
 * @property {string} name Logical store name
 * @property {string} [schemaKey] Schema key inside config/schema.json
 * @property {() => T} defaultValue Function that returns a default value when the storage file is missing
 * @property {(raw: unknown) => Promise<MigrationResult<T>> | MigrationResult<T>} [migrate]
 */
const DATA_DIR = appConfig.dataDir;
const BACKUP_DIR = appConfig.backupDir;
const SCHEMA_PATH = appConfig.schemaFile;
const BACKUP_LIMIT = appConfig.backupRetention;
const ajv = new Ajv({ allErrors: true, removeAdditional: true, strict: false });
let schemaCache = null;
let rootSchemaId = null;
const READ_ACCESS_FLAG = fs.constants && typeof fs.constants.R_OK === 'number' ? fs.constants.R_OK : 0;
const WRITE_ACCESS_FLAG = fs.constants && typeof fs.constants.W_OK === 'number' ? fs.constants.W_OK : 0;
const FALLBACK_ACCESS_FLAG = fs.constants && typeof fs.constants.F_OK === 'number' ? fs.constants.F_OK : 0;
const ACCESS_FLAGS = (READ_ACCESS_FLAG | WRITE_ACCESS_FLAG) || FALLBACK_ACCESS_FLAG;
const PERMISSION_ERROR_CODE = 'STORAGE_PERMISSION_DENIED';
const PERMISSION_ERROR_MESSAGE = 'Не удалось записать данные приложения. Проверьте права доступа к каталогу и повторите попытку.';
const PERMISSION_CODES = new Set(['EACCES', 'EPERM']);
function isPermissionError(error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && PERMISSION_CODES.has(error.code));
}
function createPermissionError(action, target, cause) {
    const friendlyMessage = `${PERMISSION_ERROR_MESSAGE}\nДетали: ${action} (${target}).`;
    const permissionError = new Error(friendlyMessage);
    permissionError.name = 'StoragePermissionError';
    permissionError.code = PERMISSION_ERROR_CODE;
    permissionError.cause = cause;
    return permissionError;
}
function reportPermissionError(action, target, error, level = 'error') {
    const message = `[JsonStore] Ошибка доступа при ${action} (${target}): ${logError(error)}`;
    const logger = level === 'warn' ? console.warn : console.error;
    logger(message);
    if (error && typeof error === 'object') {
        logger(error);
    }
}
async function withPermissionHandling(action, target, task, options = {}) {
    const { warn = false } = options;
    try {
        return await task();
    }
    catch (error) {
        if (isPermissionError(error)) {
            reportPermissionError(action, target, error, warn ? 'warn' : 'error');
            if (!warn) {
                throw createPermissionError(action, target, error);
            }
            return undefined;
        }
        throw error;
    }
}
async function ensureSecureDir(dir) {
    await withPermissionHandling('создании каталога', dir, () => fs.ensureDir(dir, { mode: 0o700 }));
    await withPermissionHandling('установке прав на каталог', dir, () => fs.chmod(dir, 0o700), { warn: true });
    await withPermissionHandling('проверке доступа к каталогу', dir, () => accessAsync(dir, ACCESS_FLAGS));
}
async function ensureEnvironment() {
    await ensureSecureDir(DATA_DIR);
    await ensureSecureDir(BACKUP_DIR);
}
function formatTimestamp(date = new Date()) {
    const pad = (value) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}
async function syncAndClose(handle, action, target) {
    let capturedError = null;
    try {
        await handle.sync();
    }
    catch (error) {
        capturedError = error;
    }
    try {
        await handle.close();
    }
    catch (error) {
        if (!capturedError) {
            capturedError = error;
        }
    }
    if (!capturedError) {
        return;
    }
    if (isPermissionError(capturedError)) {
        reportPermissionError(action, target, capturedError);
        throw createPermissionError(action, target, capturedError);
    }
    throw capturedError;
}
function ensureSchemaLoaded() {
    if (!schemaCache) {
        if (!fs.existsSync(SCHEMA_PATH)) {
            throw new Error(`Schema file not found at ${SCHEMA_PATH}`);
        }
        const loaded = fs.readJsonSync(SCHEMA_PATH);
        const schemaId = typeof loaded.$id === 'string' && loaded.$id.length > 0
            ? loaded.$id
            : pathToFileURL(SCHEMA_PATH).href;
        schemaCache = loaded.$id === schemaId ? loaded : { ...loaded, $id: schemaId };
        rootSchemaId = schemaCache.$id;
        ajv.addSchema(schemaCache, rootSchemaId);
    }
    return schemaCache;
}
function loadSchema(schemaKey) {
    const schema = ensureSchemaLoaded();
    const storeSchemas = schema.stores ?? {};
    if (!(schemaKey in storeSchemas)) {
        throw new Error(`Schema for store "${schemaKey}" not found in ${SCHEMA_PATH}`);
    }
    return { $ref: `${rootSchemaId}#/stores/${schemaKey}` };
}
/**
 * Persistent JSON storage with schema validation and automatic backups.
 *
 * @template T
 */
export class JsonStore {
  /**
   * @param {JsonStoreOptions<T>} options
   */
  constructor(options) {
    this.schemaKey = options.schemaKey ?? options.name;
    this.filePath = path.join(DATA_DIR, `${options.name}.json`);
    this.defaultValue = options.defaultValue;
    this.migrate = options.migrate;
    const schema = loadSchema(this.schemaKey);
    this.validator = ajv.compile(schema);
  }

  /**
   * @returns {Promise<T>}
   */
  async read() {
    await ensureEnvironment();
    const exists = await fs.pathExists(this.filePath);
    if (!exists) {
      const initial = this.defaultValue();
      await this.write(initial);
      return initial;
    }
    const raw = await withPermissionHandling('чтении файла', this.filePath, () => fs.readFile(this.filePath, 'utf8'));
    const parsed = JSON.parse(raw);
    let migrated = false;
    let data;
    if (this.migrate) {
      const result = await this.migrate(parsed);
      data = result.data;
      migrated = result.migrated;
    } else {
      data = parsed;
    }
    if (!this.validator(data)) {
      throw new Error(`Invalid data in ${this.filePath}: ${ajv.errorsText(this.validator.errors)}`);
    }
    if (migrated) {
      await this.write(data);
    }
    return data;
  }

  /**
   * @param {T} data
   * @returns {Promise<void>}
   */
  async write(data) {
    await ensureEnvironment();
    if (!this.validator(data)) {
      throw new Error(`Validation failed for ${this.schemaKey}: ${ajv.errorsText(this.validator.errors)}`);
    }
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    const tmpName = `${path.basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`;
    const tmpFile = path.join(DATA_DIR, tmpName);
    await withPermissionHandling('записи временного файла', tmpFile, () => fs.writeFile(tmpFile, payload, { mode: 0o600 }));
    const tmpHandle = await withPermissionHandling('открытии временного файла', tmpFile, () => open(tmpFile, 'r+'));
    await syncAndClose(tmpHandle, 'синхронизации временного файла', tmpFile);
    await this.createBackup();
    let renamed = false;
    try {
      await withPermissionHandling('переименовании временного файла', `${tmpFile} -> ${this.filePath}`, () => fs.rename(tmpFile, this.filePath));
      renamed = true;
      await withPermissionHandling('установке прав на файл', this.filePath, () => fs.chmod(this.filePath, 0o600), { warn: true });
      if (process.platform !== 'win32') {
        const dirHandle = await withPermissionHandling('открытии каталога данных для синхронизации', DATA_DIR, () => open(DATA_DIR, 'r'));
        await syncAndClose(dirHandle, 'синхронизации каталога данных', DATA_DIR);
      }
    } finally {
      if (!renamed) {
        await fs.remove(tmpFile).catch(() => {});
      }
    }
  }

  /**
   * @param {(value: T) => T} mutator
   * @returns {Promise<T>}
   */
  async update(mutator) {
    const current = await this.read();
    const next = mutator(current);
    await this.write(next);
    return next;
  }

  async createBackup() {
    const exists = await fs.pathExists(this.filePath);
    if (!exists) {
      return;
    }
    await ensureSecureDir(BACKUP_DIR);
    const timestamp = formatTimestamp();
    const baseName = path.basename(this.filePath);
    const backupName = `${baseName}.${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    await withPermissionHandling('создании резервной копии', backupPath, () => fs.copyFile(this.filePath, backupPath));
    await withPermissionHandling('установке прав на резервную копию', backupPath, () => fs.chmod(backupPath, 0o600), { warn: true });
    await this.rotateBackups(baseName);
  }

  async rotateBackups(baseName) {
    const entries = await withPermissionHandling('чтении каталога резервных копий', BACKUP_DIR, () => fs.readdir(BACKUP_DIR));
    const related = entries
      .filter((name) => name.startsWith(`${baseName}.`))
      .sort((a, b) => (a > b ? -1 : 1));
    const excess = related.slice(BACKUP_LIMIT);
    await Promise.all(excess.map((file) => fs.remove(path.join(BACKUP_DIR, file)).catch(() => {})));
  }
}

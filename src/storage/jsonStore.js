import fs from 'fs-extra';
import path from 'path';
import { open } from 'fs/promises';
import { pathToFileURL } from 'url';
import Ajv from 'ajv';
import { appConfig } from '../config.js';

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
async function ensureSecureDir(dir) {
    await fs.ensureDir(dir, { mode: 0o700 });
    await fs.chmod(dir, 0o700);
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
async function syncAndClose(handle) {
    try {
        await handle.sync();
    }
    finally {
        await handle.close();
    }
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
    const raw = await fs.readFile(this.filePath, 'utf8');
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
    await fs.writeFile(tmpFile, payload, { mode: 0o600 });
    const tmpHandle = await open(tmpFile, 'r');
    await syncAndClose(tmpHandle);
    await this.createBackup();
    let renamed = false;
    try {
      await fs.rename(tmpFile, this.filePath);
      renamed = true;
      await fs.chmod(this.filePath, 0o600);
      const dirHandle = await open(DATA_DIR, 'r');
      await syncAndClose(dirHandle);
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
    await fs.copyFile(this.filePath, backupPath);
    await fs.chmod(backupPath, 0o600);
    await this.rotateBackups(baseName);
  }

  async rotateBackups(baseName) {
    const entries = await fs.readdir(BACKUP_DIR);
    const related = entries
      .filter((name) => name.startsWith(`${baseName}.`))
      .sort((a, b) => (a > b ? -1 : 1));
    const excess = related.slice(BACKUP_LIMIT);
    await Promise.all(excess.map((file) => fs.remove(path.join(BACKUP_DIR, file)).catch(() => {})));
  }
}

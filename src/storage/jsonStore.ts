import fs from 'fs-extra';
import path from 'path';
import { FileHandle, open } from 'fs/promises';
import Ajv, { ValidateFunction } from 'ajv';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.json');
const BACKUP_LIMIT = 20;

interface SchemaFile {
  stores?: Record<string, unknown>;
}

export interface JsonStoreOptions<T> {
  name: string;
  schemaKey?: string;
  defaultValue: () => T;
}

const ajv = new Ajv({ allErrors: true, removeAdditional: true });
let schemaCache: SchemaFile | null = null;

async function ensureSecureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir, { mode: 0o700 });
  await fs.chmod(dir, 0o700);
}

async function ensureEnvironment(): Promise<void> {
  await ensureSecureDir(DATA_DIR);
  await ensureSecureDir(BACKUP_DIR);
}

function formatTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function syncAndClose(handle: FileHandle): Promise<void> {
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function loadSchema(schemaKey: string): unknown {
  if (!schemaCache) {
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found at ${SCHEMA_PATH}`);
    }
    schemaCache = fs.readJsonSync(SCHEMA_PATH) as SchemaFile;
  }
  const storeSchemas = schemaCache.stores ?? {};
  const schema = storeSchemas[schemaKey];
  if (!schema) {
    throw new Error(`Schema for store "${schemaKey}" not found in ${SCHEMA_PATH}`);
  }
  return schema;
}

export class JsonStore<T> {
  private readonly filePath: string;

  private readonly schemaKey: string;

  private readonly defaultValue: () => T;

  private readonly validator: ValidateFunction<T>;

  constructor(options: JsonStoreOptions<T>) {
    this.schemaKey = options.schemaKey ?? options.name;
    this.filePath = path.join(DATA_DIR, `${options.name}.json`);
    this.defaultValue = options.defaultValue;
    const schema = loadSchema(this.schemaKey);
    this.validator = ajv.compile<T>(schema as Record<string, unknown>);
  }

  async read(): Promise<T> {
    await ensureEnvironment();
    const exists = await fs.pathExists(this.filePath);
    if (!exists) {
      const initial = this.defaultValue();
      await this.write(initial);
      return initial;
    }
    const raw = await fs.readFile(this.filePath, 'utf8');
    const data = JSON.parse(raw) as T;
    if (!this.validator(data)) {
      throw new Error(`Invalid data in ${this.filePath}: ${ajv.errorsText(this.validator.errors)}`);
    }
    return data;
  }

  async write(data: T): Promise<void> {
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

  async update(mutator: (value: T) => T): Promise<T> {
    const current = await this.read();
    const next = mutator(current);
    await this.write(next);
    return next;
  }

  private async createBackup(): Promise<void> {
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

  private async rotateBackups(baseName: string): Promise<void> {
    const entries = await fs.readdir(BACKUP_DIR);
    const related = entries
      .filter((name) => name.startsWith(`${baseName}.`))
      .sort((a, b) => (a > b ? -1 : 1));
    const excess = related.slice(BACKUP_LIMIT);
    await Promise.all(
      excess.map((file) => fs.remove(path.join(BACKUP_DIR, file)).catch(() => {}))
    );
  }
}

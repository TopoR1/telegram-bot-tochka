import fs from 'fs-extra';
import path from 'path';
import { FileHandle, open } from 'fs/promises';
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import dayjs from 'dayjs';

const ajv = new Ajv({ allErrors: true, removeAdditional: true });

export interface JsonStoreOptions<T> {
  name: string;
  schema: object;
  defaultValue: () => T;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir, { mode: 0o700 });
}

async function syncFd(fd: FileHandle): Promise<void> {
  await fd.sync();
  await fd.close();
}

export class JsonStore<T> {
  private readonly filePath: string;

  private readonly backupDir: string;

  private readonly defaultValue: () => T;

  private readonly validator: ValidateFunction<T>;

  constructor(options: JsonStoreOptions<T>) {
    const baseDir = path.resolve(process.cwd(), 'storage');
    this.filePath = path.join(baseDir, `${options.name}.json`);
    this.backupDir = path.resolve(process.cwd(), 'backups');
    this.defaultValue = options.defaultValue;
    this.validator = ajv.compile<T>(options.schema as JSONSchemaType<T>);
  }

  async read(): Promise<T> {
    await ensureDir(path.dirname(this.filePath));
    if (!(await fs.pathExists(this.filePath))) {
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
    if (!this.validator(data)) {
      throw new Error(`Validation failed: ${ajv.errorsText(this.validator.errors)}`);
    }
    const dir = path.dirname(this.filePath);
    await ensureDir(dir);
    const tmpFile = path.join(dir, `${path.basename(this.filePath)}.${process.pid}.${Date.now()}`);
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    await fs.writeFile(tmpFile, payload, { mode: 0o600 });
    const fileHandle = await open(tmpFile, 'r');
    await syncFd(fileHandle);
    await this.createBackup();
    await fs.rename(tmpFile, this.filePath);
    await fs.chmod(this.filePath, 0o600);
    const dirHandle = await open(dir, 'r');
    await syncFd(dirHandle);
  }

  async update(mutator: (value: T) => T): Promise<T> {
    const current = await this.read();
    const next = mutator(current);
    await this.write(next);
    return next;
  }

  private async createBackup(): Promise<void> {
    if (!(await fs.pathExists(this.filePath))) {
      return;
    }
    await ensureDir(this.backupDir);
    const baseName = path.basename(this.filePath);
    const timestamp = dayjs().format('YYYYMMDD-HHmmss');
    const backupPath = path.join(this.backupDir, `${baseName}.${timestamp}.json`);
    await fs.copyFile(this.filePath, backupPath);
    await fs.chmod(backupPath, 0o600);
    await this.rotateBackups(baseName);
  }

  private async rotateBackups(baseName: string): Promise<void> {
    const files = (await fs.readdir(this.backupDir))
      .filter((file) => file.startsWith(baseName))
      .sort((a, b) => (a > b ? -1 : 1));
    const limit = 20;
    const toRemove = files.slice(limit);
    await Promise.all(
      toRemove.map(async (file) => fs.remove(path.join(this.backupDir, file)))
    );
  }
}

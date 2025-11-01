import fs from 'fs-extra';
import path from 'path';
import process from 'process';

export interface AppConfig {
  dataDir: string;
  backupDir: string;
  logDir: string;
  backupRetention: number;
  schemaFile: string;
  configFilePath: string | null;
}

interface ConfigFields {
  dataDir?: string;
  backupDir?: string;
  logDir?: string;
  backupRetention?: number;
  schemaFile?: string;
}

const DEFAULTS: Required<ConfigFields> = {
  dataDir: './data',
  backupDir: './backups',
  logDir: './logs',
  backupRetention: 20,
  schemaFile: './data/schema.json'
};

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'default.json');

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.floor(value) : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function readConfigFile(filePath: string): ConfigFields {
  if (!fs.pathExistsSync(filePath)) {
    return {};
  }

  const raw = fs.readJsonSync(filePath);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Файл конфигурации ${filePath} должен содержать JSON-объект.`);
  }
  const data = raw as Record<string, unknown>;
  return {
    dataDir: pickString(data.dataDir),
    backupDir: pickString(data.backupDir),
    logDir: pickString(data.logDir),
    backupRetention: pickPositiveInt(data.backupRetention),
    schemaFile: pickString(data.schemaFile)
  };
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

const explicitConfigPath = pickString(process.env.BOT_CONFIG_PATH);
const configPath = explicitConfigPath ? resolvePath(explicitConfigPath) : DEFAULT_CONFIG_PATH;

const fileConfig = readConfigFile(configPath);

if (explicitConfigPath && Object.keys(fileConfig).length === 0) {
  throw new Error(`Файл конфигурации не найден по пути ${configPath}`);
}

const envConfig: ConfigFields = {
  dataDir: pickString(process.env.BOT_DATA_DIR ?? process.env.DATA_DIR),
  backupDir: pickString(process.env.BOT_BACKUP_DIR ?? process.env.BACKUP_DIR),
  logDir: pickString(process.env.BOT_LOG_DIR ?? process.env.LOG_DIR),
  backupRetention: pickPositiveInt(process.env.BACKUP_RETENTION ?? process.env.BOT_BACKUP_RETENTION),
  schemaFile: pickString(process.env.BOT_SCHEMA_FILE ?? process.env.SCHEMA_FILE)
};

const dataDirRaw = envConfig.dataDir ?? fileConfig.dataDir ?? DEFAULTS.dataDir;
const backupDirRaw = envConfig.backupDir ?? fileConfig.backupDir ?? DEFAULTS.backupDir;
const logDirRaw = envConfig.logDir ?? fileConfig.logDir ?? DEFAULTS.logDir;
let backupRetention = envConfig.backupRetention ?? fileConfig.backupRetention ?? DEFAULTS.backupRetention;
const schemaFileRaw = envConfig.schemaFile ?? fileConfig.schemaFile ?? path.join(dataDirRaw, path.basename(DEFAULTS.schemaFile));

if (!Number.isFinite(backupRetention) || backupRetention <= 0) {
  backupRetention = DEFAULTS.backupRetention;
}

export const appConfig: AppConfig = {
  dataDir: resolvePath(dataDirRaw),
  backupDir: resolvePath(backupDirRaw),
  logDir: resolvePath(logDirRaw),
  backupRetention: Math.max(1, Math.floor(backupRetention)),
  schemaFile: resolvePath(schemaFileRaw),
  configFilePath: fs.pathExistsSync(configPath) ? configPath : null
};

export function resolveDataPath(...segments: string[]): string {
  return path.join(appConfig.dataDir, ...segments);
}

export function resolveBackupPath(...segments: string[]): string {
  return path.join(appConfig.backupDir, ...segments);
}

export function resolveLogPath(...segments: string[]): string {
  return path.join(appConfig.logDir, ...segments);
}

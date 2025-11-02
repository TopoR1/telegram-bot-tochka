import fs from 'fs-extra';
import path from 'path';
import process from 'process';

export type BotMode = 'polling' | 'webhook';

export interface PollingConfig {
  timeout?: number;
  limit?: number;
  allowedUpdates?: string[];
  dropPendingUpdates?: boolean;
}

export interface WebhookConfig {
  url: string;
  port: number;
  secret?: string;
  host?: string;
  keyPath?: string;
  certPath?: string;
}

export interface BotConfig {
  token?: string;
  mode: BotMode;
  polling: PollingConfig;
  webhook?: WebhookConfig;
}

export interface AppConfig {
  dataDir: string;
  backupDir: string;
  logDir: string;
  backupRetention: number;
  schemaFile: string;
  configFilePath: string | null;
  bot: BotConfig;
}

interface RawPollingConfig {
  timeout?: number;
  limit?: number;
  allowedUpdates?: string[];
  dropPendingUpdates?: boolean;
}

interface RawWebhookConfig {
  url?: string;
  port?: number;
  secret?: string;
  host?: string;
  keyPath?: string;
  certPath?: string;
}

interface RawBotConfig {
  token?: string;
  mode?: string;
  polling?: RawPollingConfig;
  webhook?: RawWebhookConfig;
}

interface ConfigFields {
  dataDir?: string;
  backupDir?: string;
  logDir?: string;
  backupRetention?: number;
  schemaFile?: string;
  bot?: RawBotConfig;
}

const DEFAULTS: Required<Omit<ConfigFields, 'bot'>> = {
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

function pickBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(lowered)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(lowered)) {
      return false;
    }
  }
  return undefined;
}

function pickStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const result = value.map((item) => pickString(item)).filter((item): item is string => Boolean(item));
    return result.length > 0 ? result : undefined;
  }
  if (typeof value === 'string') {
    const items = value
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function readPollingConfig(value: unknown): RawPollingConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    timeout: pickPositiveInt(data.timeout),
    limit: pickPositiveInt(data.limit),
    allowedUpdates: pickStringArray(data.allowedUpdates),
    dropPendingUpdates: pickBoolean(data.dropPendingUpdates)
  };
}

function readWebhookConfig(value: unknown): RawWebhookConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    url: pickString(data.url),
    port: pickPositiveInt(data.port),
    secret: pickString(data.secret),
    host: pickString(data.host),
    keyPath: pickString(data.keyPath),
    certPath: pickString(data.certPath)
  };
}

function readBotConfig(value: unknown): RawBotConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    token: pickString(data.token),
    mode: pickString(data.mode),
    polling: readPollingConfig(data.polling),
    webhook: readWebhookConfig(data.webhook)
  };
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
    schemaFile: pickString(data.schemaFile),
    bot: readBotConfig(data.bot)
  };
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function resolveOptionalPath(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return resolvePath(value);
}

const explicitConfigPath = pickString(process.env.BOT_CONFIG_PATH);
const configPath = explicitConfigPath ? resolvePath(explicitConfigPath) : DEFAULT_CONFIG_PATH;

const fileConfig = readConfigFile(configPath);

if (explicitConfigPath && Object.keys(fileConfig).length === 0) {
  throw new Error(`Файл конфигурации не найден по пути ${configPath}`);
}

const envBotConfig: RawBotConfig = {
  token: pickString(process.env.BOT_TOKEN),
  mode: pickString(process.env.BOT_MODE),
  polling: {
    timeout: pickPositiveInt(process.env.BOT_POLLING_TIMEOUT),
    limit: pickPositiveInt(process.env.BOT_POLLING_LIMIT),
    allowedUpdates: pickStringArray(process.env.BOT_ALLOWED_UPDATES),
    dropPendingUpdates: pickBoolean(process.env.BOT_DROP_PENDING_UPDATES)
  },
  webhook: {
    url: pickString(process.env.BOT_WEBHOOK_URL),
    port: pickPositiveInt(process.env.BOT_WEBHOOK_PORT),
    secret: pickString(process.env.BOT_WEBHOOK_SECRET),
    host: pickString(process.env.BOT_WEBHOOK_HOST),
    keyPath: pickString(process.env.BOT_WEBHOOK_KEY_PATH),
    certPath: pickString(process.env.BOT_WEBHOOK_CERT_PATH)
  }
};

const envConfig: ConfigFields = {
  dataDir: pickString(process.env.BOT_DATA_DIR ?? process.env.DATA_DIR),
  backupDir: pickString(process.env.BOT_BACKUP_DIR ?? process.env.BACKUP_DIR),
  logDir: pickString(process.env.BOT_LOG_DIR ?? process.env.LOG_DIR),
  backupRetention: pickPositiveInt(process.env.BACKUP_RETENTION ?? process.env.BOT_BACKUP_RETENTION),
  schemaFile: pickString(process.env.BOT_SCHEMA_FILE ?? process.env.SCHEMA_FILE),
  bot: envBotConfig
};

const dataDirRaw = envConfig.dataDir ?? fileConfig.dataDir ?? DEFAULTS.dataDir;
const backupDirRaw = envConfig.backupDir ?? fileConfig.backupDir ?? DEFAULTS.backupDir;
const logDirRaw = envConfig.logDir ?? fileConfig.logDir ?? DEFAULTS.logDir;
let backupRetention = envConfig.backupRetention ?? fileConfig.backupRetention ?? DEFAULTS.backupRetention;
const schemaFileRaw = envConfig.schemaFile ?? fileConfig.schemaFile ?? path.join(dataDirRaw, path.basename(DEFAULTS.schemaFile));

if (!Number.isFinite(backupRetention) || backupRetention <= 0) {
  backupRetention = DEFAULTS.backupRetention;
}

const fileBot = fileConfig.bot ?? {};
const envBot = envConfig.bot ?? {};
const botModeRaw = (envBot.mode ?? fileBot.mode ?? 'polling').toLowerCase();
const botMode: BotMode = botModeRaw === 'webhook' ? 'webhook' : 'polling';

const pollingConfig: PollingConfig = {
  timeout: envBot.polling?.timeout ?? fileBot.polling?.timeout,
  limit: envBot.polling?.limit ?? fileBot.polling?.limit,
  allowedUpdates: envBot.polling?.allowedUpdates ?? fileBot.polling?.allowedUpdates,
  dropPendingUpdates: envBot.polling?.dropPendingUpdates ?? fileBot.polling?.dropPendingUpdates
};

const mergedWebhook: RawWebhookConfig = {
  ...fileBot.webhook,
  ...envBot.webhook
};

const webhookConfig: WebhookConfig | undefined = mergedWebhook.url && mergedWebhook.port
  ? {
      url: mergedWebhook.url,
      port: mergedWebhook.port,
      secret: mergedWebhook.secret,
      host: mergedWebhook.host,
      keyPath: resolveOptionalPath(mergedWebhook.keyPath),
      certPath: resolveOptionalPath(mergedWebhook.certPath)
    }
  : undefined;

export const appConfig: AppConfig = {
  dataDir: resolvePath(dataDirRaw),
  backupDir: resolvePath(backupDirRaw),
  logDir: resolvePath(logDirRaw),
  backupRetention: Math.max(1, Math.floor(backupRetention)),
  schemaFile: resolvePath(schemaFileRaw),
  configFilePath: fs.pathExistsSync(configPath) ? configPath : null,
  bot: {
    token: envBot.token ?? fileBot.token,
    mode: botMode,
    polling: pollingConfig,
    webhook: webhookConfig
  }
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

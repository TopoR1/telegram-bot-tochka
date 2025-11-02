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
  secret: string;
  port: number;
  host?: string;
  path?: string;
}

export interface BotConfig {
  token: string;
  mode: BotMode;
  polling?: PollingConfig;
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

interface PartialWebhookConfig {
  url?: string;
  secret?: string;
  port?: number;
  host?: string;
  path?: string;
}

interface PartialPollingConfig {
  timeout?: number;
  limit?: number;
  allowedUpdates?: string[];
  dropPendingUpdates?: boolean;
}

interface ConfigFields {
  dataDir?: string;
  backupDir?: string;
  logDir?: string;
  backupRetention?: number;
  schemaFile?: string;
  botToken?: string;
  botMode?: BotMode;
  webhook?: PartialWebhookConfig;
  polling?: PartialPollingConfig;
}

const DEFAULTS: Required<Pick<ConfigFields, 'dataDir' | 'backupDir' | 'logDir' | 'backupRetention' | 'schemaFile'>> = {
  dataDir: './data',
  backupDir: './backups',
  logDir: './logs',
  backupRetention: 20,
  schemaFile: './data/schema.json'
};

const DEFAULT_BOT_MODE: BotMode = 'polling';

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

function pickNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? Math.floor(value) : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
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
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return undefined;
}

function pickStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => pickString(item))
      .filter((item): item is string => typeof item === 'string');
    return mapped.length > 0 || value.length === 0 ? mapped : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const mapped = trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return mapped;
  }
  return undefined;
}

function pickBotMode(value: unknown): BotMode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'polling' || normalized === 'webhook') {
    return normalized;
  }
  return undefined;
}

function parseWebhookConfig(value: unknown): PartialWebhookConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const result: PartialWebhookConfig = {};
  const url = pickString(data.url);
  if (url) {
    result.url = url;
  }
  const secret = pickString(data.secret);
  if (secret) {
    result.secret = secret;
  }
  const port = pickPositiveInt(data.port);
  if (port !== undefined) {
    result.port = port;
  }
  const host = pickString(data.host);
  if (host) {
    result.host = host;
  }
  const pathValue = pickString(data.path);
  if (pathValue) {
    result.path = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
  }
  return Object.keys(result).length > 0 ? result : {};
}

function parsePollingConfig(value: unknown): PartialPollingConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const result: PartialPollingConfig = {};
  const timeout = pickNonNegativeInt(data.timeout);
  if (timeout !== undefined) {
    result.timeout = timeout;
  }
  const limit = pickPositiveInt(data.limit);
  if (limit !== undefined) {
    result.limit = limit;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'allowedUpdates')) {
    const updates = pickStringArray(data.allowedUpdates);
    if (updates !== undefined) {
      result.allowedUpdates = updates;
    }
  }
  const dropPending = pickBoolean(data.dropPendingUpdates);
  if (dropPending !== undefined) {
    result.dropPendingUpdates = dropPending;
  }
  return Object.keys(result).length > 0 ? result : {};
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
    botToken: pickString(data.botToken),
    botMode: pickBotMode(data.botMode),
    webhook: parseWebhookConfig(data.webhook),
    polling: parsePollingConfig(data.polling)
  };
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function mergeWebhookConfig(
  base?: PartialWebhookConfig,
  override?: PartialWebhookConfig
): PartialWebhookConfig | undefined {
  const result: PartialWebhookConfig = {};
  for (const source of [base, override]) {
    if (!source) {
      continue;
    }
    if (source.url !== undefined) {
      result.url = source.url;
    }
    if (source.secret !== undefined) {
      result.secret = source.secret;
    }
    if (source.port !== undefined) {
      result.port = source.port;
    }
    if (source.host !== undefined) {
      result.host = source.host;
    }
    if (source.path !== undefined) {
      result.path = source.path;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mergePollingConfig(
  base?: PartialPollingConfig,
  override?: PartialPollingConfig
): PartialPollingConfig | undefined {
  const result: PartialPollingConfig = {};
  for (const source of [base, override]) {
    if (!source) {
      continue;
    }
    if (source.timeout !== undefined) {
      result.timeout = source.timeout;
    }
    if (source.limit !== undefined) {
      result.limit = source.limit;
    }
    if (source.allowedUpdates !== undefined) {
      result.allowedUpdates = source.allowedUpdates;
    }
    if (source.dropPendingUpdates !== undefined) {
      result.dropPendingUpdates = source.dropPendingUpdates;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function hasMeaningfulWebhookSettings(config?: PartialWebhookConfig): boolean {
  if (!config) {
    return false;
  }
  return Boolean(config.url || config.secret || config.path);
}

const explicitConfigPath = pickString(process.env.BOT_CONFIG_PATH);
const configPath = explicitConfigPath ? resolvePath(explicitConfigPath) : DEFAULT_CONFIG_PATH;

const fileConfig = readConfigFile(configPath);

if (explicitConfigPath && Object.keys(fileConfig).length === 0) {
  throw new Error(`Файл конфигурации не найден по пути ${configPath}`);
}

const envWebhook = parseWebhookConfig({
  url: process.env.BOT_WEBHOOK_URL,
  secret: process.env.BOT_WEBHOOK_SECRET,
  port: process.env.BOT_WEBHOOK_PORT,
  host: process.env.BOT_WEBHOOK_HOST,
  path: process.env.BOT_WEBHOOK_PATH
});

const envPolling = parsePollingConfig({
  timeout: process.env.BOT_POLLING_TIMEOUT,
  limit: process.env.BOT_POLLING_LIMIT,
  allowedUpdates: process.env.BOT_POLLING_ALLOWED_UPDATES,
  dropPendingUpdates: process.env.BOT_POLLING_DROP_PENDING
});

const envConfig: ConfigFields = {
  dataDir: pickString(process.env.BOT_DATA_DIR ?? process.env.DATA_DIR),
  backupDir: pickString(process.env.BOT_BACKUP_DIR ?? process.env.BACKUP_DIR),
  logDir: pickString(process.env.BOT_LOG_DIR ?? process.env.LOG_DIR),
  backupRetention: pickPositiveInt(process.env.BACKUP_RETENTION ?? process.env.BOT_BACKUP_RETENTION),
  schemaFile: pickString(process.env.BOT_SCHEMA_FILE ?? process.env.SCHEMA_FILE),
  botToken: pickString(process.env.BOT_TOKEN),
  botMode: pickBotMode(process.env.BOT_MODE),
  webhook: envWebhook,
  polling: envPolling
};

const dataDirRaw = envConfig.dataDir ?? fileConfig.dataDir ?? DEFAULTS.dataDir;
const backupDirRaw = envConfig.backupDir ?? fileConfig.backupDir ?? DEFAULTS.backupDir;
const logDirRaw = envConfig.logDir ?? fileConfig.logDir ?? DEFAULTS.logDir;
let backupRetention = envConfig.backupRetention ?? fileConfig.backupRetention ?? DEFAULTS.backupRetention;
const schemaFileRaw = envConfig.schemaFile ?? fileConfig.schemaFile ?? path.join(dataDirRaw, path.basename(DEFAULTS.schemaFile));

if (!Number.isFinite(backupRetention) || backupRetention <= 0) {
  backupRetention = DEFAULTS.backupRetention;
}

const botToken = envConfig.botToken ?? fileConfig.botToken;
if (!botToken) {
  throw new Error('Токен Telegram-бота не задан. Используйте переменную окружения BOT_TOKEN или поле botToken в конфигурации.');
}

const botMode = envConfig.botMode ?? fileConfig.botMode ?? DEFAULT_BOT_MODE;

const webhookConfig = mergeWebhookConfig(fileConfig.webhook, envConfig.webhook);
const pollingConfig = mergePollingConfig(fileConfig.polling, envConfig.polling);

const hasWebhookSettings = hasMeaningfulWebhookSettings(webhookConfig);
const hasPollingSettings = Boolean(pollingConfig && (
  pollingConfig.timeout !== undefined ||
  pollingConfig.limit !== undefined ||
  pollingConfig.allowedUpdates !== undefined ||
  pollingConfig.dropPendingUpdates !== undefined
));

if (botMode === 'polling' && hasWebhookSettings) {
  throw new Error('Настройки webhook заданы одновременно с режимом polling. Удалите параметры webhook или переключитесь в режим webhook.');
}

if (botMode === 'webhook') {
  if (hasPollingSettings) {
    throw new Error('Настройки polling нельзя использовать в режиме webhook. Удалите блок polling или переключитесь в режим polling.');
  }
  if (!webhookConfig?.url || !webhookConfig.port || !webhookConfig.secret) {
    throw new Error('Для режима webhook необходимо указать url, secret и port.');
  }
}

let resolvedWebhook: WebhookConfig | undefined;
if (botMode === 'webhook' && webhookConfig) {
  resolvedWebhook = {
    url: webhookConfig.url,
    secret: webhookConfig.secret,
    port: webhookConfig.port,
    host: webhookConfig.host,
    path: webhookConfig.path
  };
}

let resolvedPolling: PollingConfig | undefined;
if (botMode === 'polling' && pollingConfig) {
  resolvedPolling = {
    timeout: pollingConfig.timeout,
    limit: pollingConfig.limit,
    allowedUpdates: pollingConfig.allowedUpdates,
    dropPendingUpdates: pollingConfig.dropPendingUpdates
  };
}

export const appConfig: AppConfig = {
  dataDir: resolvePath(dataDirRaw),
  backupDir: resolvePath(backupDirRaw),
  logDir: resolvePath(logDirRaw),
  backupRetention: Math.max(1, Math.floor(backupRetention)),
  schemaFile: resolvePath(schemaFileRaw),
  configFilePath: fs.pathExistsSync(configPath) ? configPath : null,
  bot: {
    token: botToken,
    mode: botMode,
    polling: resolvedPolling,
    webhook: resolvedWebhook
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

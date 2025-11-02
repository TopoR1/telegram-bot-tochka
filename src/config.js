import fs from 'fs-extra';
import path from 'path';
import process from 'process';
const DEFAULTS = {
    dataDir: './data',
    backupDir: './backups',
    logDir: './logs',
    backupRetention: 20,
    schemaFile: './data/schema.json'
};
const DEFAULT_BOT_MODE = 'polling';
const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), 'config', 'default.json');
function pickString(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function pickPositiveInt(value) {
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
function pickNonNegativeInt(value) {
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
function pickBoolean(value) {
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
function pickStringArray(value) {
    if (Array.isArray(value)) {
        const mapped = value
            .map((item) => pickString(item))
            .filter((item) => typeof item === 'string');
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
function pickBotMode(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'polling' || normalized === 'webhook') {
        return normalized;
    }
    return undefined;
}
function parseWebhookConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const data = value;
    const result = {};
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
function parsePollingConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const data = value;
    const result = {};
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
function parseBotConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const data = value;
    const result = {};
    const token = pickString(data.token);
    if (token) {
        result.token = token;
    }
    const mode = pickBotMode(data.mode);
    if (mode) {
        result.mode = mode;
    }
    const webhook = parseWebhookConfig(data.webhook);
    if (webhook) {
        result.webhook = webhook;
    }
    const polling = parsePollingConfig(data.polling);
    if (polling) {
        result.polling = polling;
    }
    return Object.keys(result).length > 0 ? result : {};
}
function readConfigFile(filePath) {
    if (!fs.pathExistsSync(filePath)) {
        return {};
    }
    const raw = fs.readJsonSync(filePath);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`Файл конфигурации ${filePath} должен содержать JSON-объект.`);
    }
    const data = raw;
    return {
        dataDir: pickString(data.dataDir),
        backupDir: pickString(data.backupDir),
        logDir: pickString(data.logDir),
        backupRetention: pickPositiveInt(data.backupRetention),
        schemaFile: pickString(data.schemaFile),
        bot: parseBotConfig(data.bot)
    };
}
function resolvePath(value) {
    return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}
function mergeWebhookConfig(base, override) {
    const result = {};
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
function mergePollingConfig(base, override) {
    const result = {};
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
function hasMeaningfulWebhookSettings(config) {
    if (!config) {
        return false;
    }
    return Boolean(config.url || config.secret || config.port || config.path);
}
function hasMeaningfulPollingSettings(config) {
    if (!config) {
        return false;
    }
    return Boolean(config.timeout !== undefined ||
        config.limit !== undefined ||
        config.allowedUpdates !== undefined ||
        config.dropPendingUpdates !== undefined);
}
const explicitConfigPath = pickString(process.env.BOT_CONFIG_PATH);
const configPath = explicitConfigPath ? resolvePath(explicitConfigPath) : DEFAULT_CONFIG_PATH;
const fileConfig = readConfigFile(configPath);
if (explicitConfigPath && Object.keys(fileConfig).length === 0) {
    throw new Error(`Файл конфигурации не найден по пути ${configPath}`);
}
const envConfig = {
    dataDir: pickString(process.env.BOT_DATA_DIR ?? process.env.DATA_DIR),
    backupDir: pickString(process.env.BOT_BACKUP_DIR ?? process.env.BACKUP_DIR),
    logDir: pickString(process.env.BOT_LOG_DIR ?? process.env.LOG_DIR),
    backupRetention: pickPositiveInt(process.env.BACKUP_RETENTION ?? process.env.BOT_BACKUP_RETENTION),
    schemaFile: pickString(process.env.BOT_SCHEMA_FILE ?? process.env.SCHEMA_FILE),
    bot: {
        token: pickString(process.env.BOT_TOKEN),
        mode: pickBotMode(process.env.BOT_MODE),
        webhook: parseWebhookConfig({
            url: process.env.BOT_WEBHOOK_URL,
            secret: process.env.BOT_WEBHOOK_SECRET,
            port: process.env.BOT_WEBHOOK_PORT,
            host: process.env.BOT_WEBHOOK_HOST,
            path: process.env.BOT_WEBHOOK_PATH
        }),
        polling: parsePollingConfig({
            timeout: process.env.BOT_POLLING_TIMEOUT,
            limit: process.env.BOT_POLLING_LIMIT,
            allowedUpdates: process.env.BOT_POLLING_ALLOWED_UPDATES,
            dropPendingUpdates: process.env.BOT_POLLING_DROP_PENDING
        })
    }
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
const botToken = envBot.token ?? fileBot.token;
if (!botToken) {
    throw new Error('Токен Telegram-бота не задан. Используйте переменную окружения BOT_TOKEN или поле bot.token в конфигурации.');
}
const botMode = envBot.mode ?? fileBot.mode ?? DEFAULT_BOT_MODE;
const webhookConfig = mergeWebhookConfig(fileBot.webhook, envBot.webhook);
const pollingConfig = mergePollingConfig(fileBot.polling, envBot.polling);
const hasWebhookSettings = hasMeaningfulWebhookSettings(webhookConfig);
const hasPollingSettings = hasMeaningfulPollingSettings(pollingConfig);
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
let resolvedWebhook;
if (botMode === 'webhook' && webhookConfig) {
    resolvedWebhook = {
        url: webhookConfig.url,
        secret: webhookConfig.secret,
        port: webhookConfig.port,
        host: webhookConfig.host,
        path: webhookConfig.path
    };
}
let resolvedPolling;
if (botMode === 'polling' && pollingConfig) {
    resolvedPolling = {
        timeout: pollingConfig.timeout,
        limit: pollingConfig.limit,
        allowedUpdates: pollingConfig.allowedUpdates,
        dropPendingUpdates: pollingConfig.dropPendingUpdates
    };
}
export const appConfig = {
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
export function resolveDataPath(...segments) {
    return path.join(appConfig.dataDir, ...segments);
}
export function resolveBackupPath(...segments) {
    return path.join(appConfig.backupDir, ...segments);
}
export function resolveLogPath(...segments) {
    return path.join(appConfig.logDir, ...segments);
}

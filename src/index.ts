import 'dotenv/config';
import process from 'process';
import fs from 'fs-extra';
import { createBot } from './bot/index.js';
import { writeAuditLog } from './utils/logger.js';
import { appConfig } from './config.js';

async function ensureSecureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir, { mode: 0o700 });
  await fs.chmod(dir, 0o700);
}

async function bootstrap(): Promise<void> {
  const token = appConfig.bot.token;
  if (!token) {
    throw new Error('Токен бота не задан. Укажите его в переменной окружения BOT_TOKEN или в конфиге (bot.token).');
  }
  await Promise.all([
    ensureSecureDir(appConfig.dataDir),
    ensureSecureDir(appConfig.backupDir),
    ensureSecureDir(appConfig.logDir)
  ]);
  const bot = createBot(token);
  if (appConfig.bot.mode === 'webhook') {
    throw new Error('Webhook-режим пока не поддерживается запуском сервера. Используйте режим polling.');
  }

  const launchOptions: Record<string, unknown> = {};
  const pollingOptions: Record<string, number> = {};
  const { polling } = appConfig.bot;
  if (typeof polling.timeout === 'number') {
    pollingOptions.timeout = polling.timeout;
  }
  if (typeof polling.limit === 'number') {
    pollingOptions.limit = polling.limit;
  }
  if (Object.keys(pollingOptions).length > 0) {
    launchOptions.polling = pollingOptions;
  }
  if (typeof polling.dropPendingUpdates === 'boolean') {
    launchOptions.dropPendingUpdates = polling.dropPendingUpdates;
  }
  if (polling.allowedUpdates && polling.allowedUpdates.length > 0) {
    launchOptions.allowedUpdates = polling.allowedUpdates;
  }

  await bot.launch(launchOptions);
  console.log('Bot started');
  await writeAuditLog({ name: 'system.start', details: { event: 'bot.start' } });

  const shutdown = async () => {
    console.log('Stopping bot...');
    await bot.stop('SIGTERM');
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

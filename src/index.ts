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
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('Переменная окружения BOT_TOKEN не задана.');
  }
  await Promise.all([
    ensureSecureDir(appConfig.dataDir),
    ensureSecureDir(appConfig.backupDir),
    ensureSecureDir(appConfig.logDir)
  ]);
  const bot = createBot(token);
  await bot.launch();
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

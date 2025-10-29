import 'dotenv/config';
import process from 'process';
import fs from 'fs-extra';
import path from 'path';
import { createBot } from './bot/index.js';
import { writeAuditLog } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('Переменная окружения BOT_TOKEN не задана.');
  }
  await fs.ensureDir(path.resolve(process.cwd(), 'storage'), { mode: 0o700 });
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

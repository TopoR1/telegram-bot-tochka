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
  const { bot: botSettings } = appConfig;

  await Promise.all([
    ensureSecureDir(appConfig.dataDir),
    ensureSecureDir(appConfig.backupDir),
    ensureSecureDir(appConfig.logDir)
  ]);

  const bot = createBot(botSettings.token);

  type BotLaunchOptions = Parameters<typeof bot.launch>[0];
  let launchOptions: BotLaunchOptions | undefined;

  if (botSettings.mode === 'webhook') {
    const webhook = botSettings.webhook;
    if (!webhook) {
      throw new Error('Режим webhook выбран, но настройки webhook не заданы.');
    }

    const webhookUrl = new URL(webhook.url);
    const hookPathRaw = webhook.path ?? webhookUrl.pathname;
    const hookPath = hookPathRaw && hookPathRaw.length > 0 ? hookPathRaw : '/';

    launchOptions = {
      webhook: {
        domain: webhookUrl.origin,
        hookPath,
        host: webhook.host ?? '0.0.0.0',
        port: webhook.port,
        secretToken: webhook.secret
      }
    };
  } else if (botSettings.mode === 'polling') {
    const pollingOptions: Record<string, unknown> = {};
    const polling = botSettings.polling;
    if (polling) {
      if (polling.timeout !== undefined) {
        pollingOptions.timeout = polling.timeout;
      }
      if (polling.limit !== undefined) {
        pollingOptions.limit = polling.limit;
      }
      if (polling.allowedUpdates !== undefined) {
        pollingOptions.allowedUpdates = polling.allowedUpdates;
      }
      if (polling.dropPendingUpdates !== undefined) {
        pollingOptions.dropPendingUpdates = polling.dropPendingUpdates;
      }
    }

    if (Object.keys(pollingOptions).length > 0) {
      launchOptions = { polling: pollingOptions } as BotLaunchOptions;
    }
  }

  if (launchOptions) {
    await bot.launch(launchOptions);
  } else {
    await bot.launch();
  }

  console.log(`Bot started in ${botSettings.mode} mode`);
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

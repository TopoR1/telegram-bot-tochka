import { Telegraf } from 'telegraf';
import { BotContext } from './types.js';
import {
  handleStart,
  handleReset,
  handleContact,
  handleText,
  handleCardsRequest,
  handleLastTaskButton
} from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { LAST_TASK_BUTTON_LABEL } from './keyboards/courier.js';
import {
  handleGetAdmin,
  handleDocument,
  handleBindGroup,
  handleAnnounceCommand,
  handleAnnounceSelection,
  handleAnnounceText,
  handleBindGroupSelection
} from './adminHandlers.js';
import { handleChatMember, handleMyChatMember } from './handlers/chatMembers.js';
export function createBot(token: string): Telegraf<BotContext> {
  if (!token || token.trim().length === 0) {
    throw new Error('Токен Telegram-бота не задан. Передайте непустой токен в createBot.');
  }

  const bot = new Telegraf<BotContext>(token);

  bot.start(handleStart);
  bot.command('reset', handleReset);
  bot.command('cards', handleCardsRequest);
  bot.command('help', handleHelp);
  bot.command('get_admin', handleGetAdmin);
  bot.command('bind_group', handleBindGroup);
  bot.command('announce', handleAnnounceCommand);

  bot.hears(LAST_TASK_BUTTON_LABEL, handleLastTaskButton);

  bot.on('contact', handleContact);
  bot.on('document', handleDocument);
  bot.on('my_chat_member', handleMyChatMember);
  bot.on('chat_member', handleChatMember);
  bot.on('callback_query', async (ctx, next) => {
    const handled = (await handleBindGroupSelection(ctx)) || (await handleAnnounceSelection(ctx));
    if (!handled && next) {
      await next();
    }
  });
  bot.on('text', async (ctx, next) => {
    await handleAnnounceText(ctx);
    await handleText(ctx);
    if (next) await next();
  });

  bot.catch(async (err, ctx) => {
    console.error('Bot error:', err);
    await ctx.reply?.('Ой! Что-то пошло не так. Попробуйте еще раз позже.');
  });

  return bot;
}

import { Chat } from 'telegraf/typings/core/types/typegram';
import { BotContext } from '../types.js';
import { writeAuditLog, logError } from '../../utils/logger.js';

function resolveChatTitle(chat: Chat): string {
  if ('title' in chat && chat.title) {
    return chat.title;
  }
  if ('username' in chat && chat.username) {
    return `@${chat.username}`;
  }
  return 'этом чате';
}

function buildAdminRequestMessage(chat: Chat): string {
  const title = resolveChatTitle(chat);
  return [
    `Привет! Спасибо, что добавили меня в «${title}».`,
    'Чтобы я мог публиковать анонсы, пожалуйста:',
    '• сделайте меня администратором с правами на отправку сообщений, управление темами и удаление сообщений;',
    '• решите, в какой теме публиковать анонсы: можно выбрать существующую или позволить мне создать новую;',
    '• в личном чате со мной выполните команду /bind_group и перешлите любое сообщение из этой группы.'
  ].join('\n');
}

function buildAdminGrantedMessage(chat: Chat): string {
  const title = resolveChatTitle(chat);
  return [
    `Спасибо! Теперь у меня есть права администратора в «${title}».`,
    'Откройте диалог со мной и выполните /bind_group, чтобы выбрать тему для публикации анонсов.'
  ].join('\n');
}

export async function handleMyChatMember(ctx: BotContext): Promise<void> {
  const update = ctx.myChatMember;
  if (!update) return;

  const details = {
    scope: 'my_chat_member',
    chatId: update.chat.id,
    oldStatus: update.old_chat_member.status,
    newStatus: update.new_chat_member.status
  };
  await writeAuditLog({ name: 'system.chat_update', details });

  if (update.new_chat_member.status === 'member') {
    try {
      await ctx.telegram.sendMessage(update.chat.id, buildAdminRequestMessage(update.chat));
    } catch (err) {
      await writeAuditLog({
        name: 'system.chat_update',
        details: { ...details, error: `notify_failed:${logError(err)}` }
      });
    }
    return;
  }

  if (
    update.new_chat_member.status === 'administrator' &&
    update.old_chat_member.status !== 'administrator'
  ) {
    try {
      await ctx.telegram.sendMessage(update.chat.id, buildAdminGrantedMessage(update.chat));
    } catch (err) {
      await writeAuditLog({
        name: 'system.chat_update',
        details: { ...details, error: `notify_failed:${logError(err)}` }
      });
    }
  }
}

export async function handleChatMember(ctx: BotContext): Promise<void> {
  const update = ctx.chatMember;
  if (!update) return;
  await writeAuditLog({
    name: 'system.chat_update',
    details: {
      scope: 'chat_member',
      chatId: update.chat.id,
      userId: update.new_chat_member.user.id,
      oldStatus: update.old_chat_member.status,
      newStatus: update.new_chat_member.status
    }
  });
}

import { Markup } from 'telegraf';
import dayjs from 'dayjs';
import { BotContext } from './types.js';
import { attachSession, persistSession } from './session.js';
import { getOrCreateAdmin, updateAdmin, listGroupBindings } from '../services/adminService.js';
import { parseXlsx } from '../services/xlsxParser.js';
import { attachCouriers } from '../services/courierMatcher.js';
import { broadcastCards } from '../services/broadcast.js';
import { writeAuditLog, logError } from '../utils/logger.js';
import { announcementStore } from '../storage/index.js';
import { Chat } from 'telegraf/typings/core/types/typegram';
import { GroupBinding } from '../services/types.js';

export async function handleGetAdmin(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from) return;
  const admin = await getOrCreateAdmin(ctx.from.id, {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name
  });
  ctx.adminProfile = admin;
  await ctx.reply('Вы зарегистрированы как администратор. Отправьте .xlsx файл с карточками.');
  persistSession(ctx);
}

async function loadFileBuffer(ctx: BotContext, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error('Не удалось загрузить файл из Telegram.');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function handleDocument(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message || !('document' in ctx.message)) return;
  try {
    const admin = await getOrCreateAdmin(ctx.from.id, {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name
    });
    ctx.adminProfile = admin;
    const document = ctx.message.document;
    if (!document.file_name?.endsWith('.xlsx')) {
      await ctx.reply('Пожалуйста, пришлите файл в формате .xlsx.');
      return;
    }
    await ctx.reply('Начинаю обработку файла, это займет несколько секунд...');
    const buffer = await loadFileBuffer(ctx, document.file_id);
    const cards = parseXlsx(buffer, ctx.from.id);
    const enriched = await attachCouriers(ctx.from.id, cards);
    const report = await broadcastCards(ctx.telegram, enriched);
    await updateAdmin(ctx.from.id, (existing) => ({
      ...existing,
      lastUploadAt: dayjs().toISOString()
    }));
    await ctx.reply(`Готово! ${report.reportText}`);
    await writeAuditLog({ name: 'admin.upload', userId: ctx.from.id, details: { total: report.total } });
  } catch (err) {
    await ctx.reply(`Не удалось обработать файл: ${logError(err)}.`);
  }
}

export async function handleBindGroup(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message) return;
  if (!('forward_from_chat' in ctx.message) || !ctx.message.forward_from_chat) {
    await ctx.reply('Перешлите сообщение из нужного чата вместе с этой командой.');
    return;
  }
  const chat = ctx.message.forward_from_chat as Chat;
  const chatTitle = 'title' in chat && chat.title ? chat.title : undefined;
  const chatUsername = 'username' in chat && chat.username ? chat.username : undefined;
  const binding: GroupBinding = {
    chatId: chat.id,
    title: chatTitle ?? chatUsername ?? `Чат ${chat.id}`,
    threadId:
      'is_topic_message' in ctx.message && ctx.message.is_topic_message
        ? ctx.message.message_thread_id ?? undefined
        : undefined
  };
  await updateAdmin(ctx.from.id, (existing) => ({
    ...existing,
    groupBindings: [
      ...existing.groupBindings.filter((item) => item.chatId !== binding.chatId || item.threadId !== binding.threadId),
      binding
    ]
  }));
  await ctx.reply(`Чат «${binding.title}» сохранен. Используйте /announce, чтобы отправить сообщение.`);
  persistSession(ctx);
}

export async function handleAnnounceCommand(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  const messageText = ctx.message.text.replace(/^\/announce\s*/, '');
  const bindings = await listGroupBindings(ctx.from.id);
  if (!bindings.length) {
    await ctx.reply('Сначала привяжите группу командой /bind_group, переслав сообщение из нее.');
    return;
  }
  ctx.sessionState = {
    ...(ctx.sessionState ?? {}),
    awaitingAnnouncement: true,
    pendingAnnouncementText: messageText || undefined
  };
  const keyboard = Markup.inlineKeyboard(
    bindings.map((binding) => Markup.button.callback(binding.title, `announce:${binding.chatId}:${binding.threadId ?? 0}`))
  );
  await ctx.reply(messageText ? 'Выберите чат для публикации этого анонса.' : 'Выберите чат и отправьте текст анонса.', keyboard);
  persistSession(ctx);
}

export async function handleAnnounceSelection(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.callbackQuery) return;
  const query = ctx.callbackQuery;
  if (!('data' in query)) return;
  const data = query.data;
  if (!data?.startsWith('announce:')) return;
  const [, chatIdRaw, threadIdRaw] = data.split(':');
  const chatId = Number(chatIdRaw);
  const threadId = Number(threadIdRaw);
  const bindings = await listGroupBindings(ctx.from.id);
  const selected = bindings.find((binding) => binding.chatId === chatId && (binding.threadId ?? 0) === threadId);
  if (!selected) {
    await ctx.answerCbQuery('Не удалось найти выбранный чат.');
    return;
  }
  ctx.sessionState = {
    ...(ctx.sessionState ?? {}),
    awaitingAnnouncement: true,
    selectedGroup: selected
  };
  await ctx.answerCbQuery(`Чат ${selected.title}`);
  if (ctx.sessionState?.pendingAnnouncementText) {
    await sendAnnouncement(ctx, ctx.sessionState.pendingAnnouncementText, selected);
    ctx.sessionState = { awaitingAnnouncement: false };
  } else {
    await ctx.reply(`Отправьте текст анонса для ${selected.title}.`);
  }
  persistSession(ctx);
}

export async function handleAnnounceText(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  if (!ctx.sessionState?.awaitingAnnouncement) return;
  const text = ctx.message.text;
  if (!ctx.sessionState.selectedGroup) {
    ctx.sessionState.pendingAnnouncementText = text;
    await ctx.reply('Теперь выберите чат из списка выше.');
    persistSession(ctx);
    return;
  }
  await sendAnnouncement(ctx, text, ctx.sessionState.selectedGroup);
  ctx.sessionState = { awaitingAnnouncement: false };
  persistSession(ctx);
}

async function sendAnnouncement(ctx: BotContext, message: string, target: GroupBinding): Promise<void> {
  try {
    await ctx.telegram.sendMessage(target.chatId, message, {
      message_thread_id: target.threadId
    });
    await announcementStore.update((collection) => {
      collection.push({
        adminId: ctx.from!.id,
        target,
        message,
        sentAt: dayjs().toISOString()
      });
      return collection;
    });
    await writeAuditLog({ name: 'admin.announce', userId: ctx.from!.id, details: { chatId: target.chatId } });
    await ctx.reply(`Анонс опубликован в ${target.title}.`);
  } catch (err) {
    await ctx.reply(`Не удалось опубликовать анонс: ${logError(err)}.`);
  }
}

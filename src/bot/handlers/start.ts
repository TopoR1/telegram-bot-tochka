import { BotContext } from '../types.js';
import { attachSession, persistSession } from '../session.js';
import {
  getOrCreateCourier,
  updateCourier
} from '../../services/courierService.js';
import { normalizePhone } from '../../utils/phone.js';
import { normalizeFullName } from '../../utils/name.js';
import { writeAuditLog } from '../../utils/logger.js';
import { upsertUser, markTaskRequest } from '../../storage/usersStore.js';
import { searchLatestTasks } from '../../services/task-search.js';
import { buildTaskCard } from '../messages/taskCard.js';
import { createCourierStartKeyboard } from '../keyboards/courier.js';

interface DeliverOptions {
  notifyWhenEmpty?: boolean;
  limit?: number;
  reason?: 'auto' | 'command' | 'button';
}

function collectProfile(ctx: BotContext): { username?: string; firstName?: string; lastName?: string } {
  if (!ctx.from) return {};
  return {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name
  };
}

async function deliverLatestTasks(ctx: BotContext, options: DeliverOptions = {}): Promise<void> {
  if (!ctx.from) return;
  const { notifyWhenEmpty = false, limit = 5, reason = 'command' } = options;
  const result = await searchLatestTasks({ telegramId: ctx.from.id, limit });
  await markTaskRequest(ctx.from.id);
  await writeAuditLog({
    name: 'courier.task_request',
    userId: ctx.from.id,
    phone: result.normalizedPhone,
    details: { reason, count: result.cards.length }
  });

  if (!result.courier) {
    if (notifyWhenEmpty) {
      await ctx.reply('Вы ещё не зарегистрированы. Используйте /start и отправьте номер телефона.');
    }
    return;
  }

  if (!result.cards.length) {
    if (notifyWhenEmpty) {
      await ctx.reply('Пока не удалось найти для вас актуальные задания. Попробуйте позже.');
    }
    return;
  }

  const intro = result.cards.length > 1 ? `Нашли ${result.cards.length} последних заданий:` : 'Нашли актуальное задание:';
  await ctx.reply(intro);
  for (const card of result.cards) {
    const { text, options } = buildTaskCard(card);
    await ctx.reply(text, options);
  }
}

async function handlePhoneSubmission(ctx: BotContext, rawPhone: string, options: { validated: boolean }): Promise<void> {
  attachSession(ctx);
  if (!ctx.from) return;
  const normalizedPhone = normalizePhone(rawPhone);
  if (!normalizedPhone) {
    await ctx.reply('Не удалось распознать номер. Убедитесь, что он в формате 8XXXXXXXXXX.');
    return;
  }

  const profile = collectProfile(ctx);
  const awaitingFullName = Boolean(ctx.sessionState?.awaitingFullName || !ctx.courierProfile?.fullName);
  const courier = await getOrCreateCourier(ctx.from.id, {
    ...profile,
    phone: normalizedPhone,
    awaitingFullName
  });
  ctx.courierProfile = courier;

  const shouldRequestFullName = !courier.fullName;
  ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: shouldRequestFullName };

  await upsertUser({
    telegramId: ctx.from.id,
    ...profile,
    phone: rawPhone,
    normalizedPhone,
    phoneValidated: options.validated
  });

  await writeAuditLog({
    name: 'courier.register',
    userId: ctx.from.id,
    phone: normalizedPhone,
    details: { source: options.validated ? 'contact' : 'text' }
  });

  if (shouldRequestFullName) {
    await ctx.reply('Спасибо! Теперь введите ваше ФИО одной строкой.');
  } else {
    await ctx.reply('Номер обновлён. Проверяем для вас задания...');
  }

  persistSession(ctx);
  await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'auto' });
}

export async function handleStart(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from) return;
  const profile = collectProfile(ctx);
  const courier = await getOrCreateCourier(ctx.from.id, {
    ...profile,
    awaitingFullName: false
  });
  ctx.courierProfile = courier;
  const awaitingFullName = courier.awaitingFullName ?? !courier.fullName;
  ctx.sessionState = { awaitingFullName };

  await upsertUser({ telegramId: ctx.from.id, ...profile });

  await ctx.reply(
    'Добро пожаловать! Отправьте свой номер телефона кнопкой ниже или введите его вручную в формате 8XXXXXXXXXX.',
    createCourierStartKeyboard()
  );
  persistSession(ctx);
}

export async function handleReset(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from) return;
  await updateCourier(ctx.from.id, (courier) => ({
    ...courier,
    phone: undefined,
    fullName: undefined,
    awaitingFullName: true
  }));
  ctx.sessionState = { awaitingFullName: true };
  const profile = collectProfile(ctx);
  await upsertUser({
    telegramId: ctx.from.id,
    ...profile,
    phone: null,
    normalizedPhone: null,
    phoneValidated: false
  });
  await ctx.reply('Данные сброшены. Отправьте новый номер телефона и ФИО.');
  await writeAuditLog({ name: 'courier.reset', userId: ctx.from.id });
  persistSession(ctx);
}

export async function handleContact(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message || !('contact' in ctx.message)) return;
  const contact = ctx.message.contact;
  if (contact.user_id && contact.user_id !== ctx.from.id) {
    await ctx.reply('Пожалуйста, отправьте контакт с вашего номера телефона.');
    return;
  }
  await handlePhoneSubmission(ctx, contact.phone_number, { validated: true });
}

export async function handleText(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
  const raw = ctx.message.text.trim();
  if (!raw) return;

  if (ctx.sessionState?.awaitingFullName) {
    const fullName = normalizeFullName(raw);
    const courier = await updateCourier(ctx.from.id, (existing) => ({
      ...existing,
      fullName,
      awaitingFullName: false
    }));
    ctx.courierProfile = courier;
    ctx.sessionState = { awaitingFullName: false };
    await ctx.reply(`Отлично, ${fullName}! Ожидайте карточки.`);
    persistSession(ctx);
    return;
  }

  const digitsCount = raw.replace(/\D/g, '').length;
  if (digitsCount >= 10) {
    await handlePhoneSubmission(ctx, raw, { validated: false });
  }
}

export async function handleCardsRequest(ctx: BotContext): Promise<void> {
  await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'command' });
}

export async function handleLastTaskButton(ctx: BotContext): Promise<void> {
  await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'button' });
}

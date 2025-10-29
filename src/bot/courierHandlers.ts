import { Markup } from 'telegraf';
import dayjs from 'dayjs';
import { BotContext } from './types.js';
import { attachSession, persistSession } from './session.js';
import { getOrCreateCourier, updateCourier, listCourierCards } from '../services/courierService.js';
import { normalizePhone, PHONE_BUTTON_LABEL } from '../utils/phone.js';
import { normalizeFullName } from '../utils/name.js';
import { formatCard } from '../utils/format.js';
import { writeAuditLog } from '../utils/logger.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from) return;
  const courier = await getOrCreateCourier(ctx.from.id, {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    awaitingFullName: false
  });
  ctx.courierProfile = courier;
  ctx.sessionState = { awaitingFullName: false };
  await ctx.reply(
    'Добро пожаловать! Нажмите кнопку ниже, чтобы отправить свой номер телефона.',
    Markup.keyboard([Markup.button.contactRequest(PHONE_BUTTON_LABEL)]).resize()
  );
  await writeAuditLog({ name: 'courier.register', userId: ctx.from.id, phone: courier.phone });
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
  const normalizedPhone = normalizePhone(contact.phone_number);
  if (!normalizedPhone) {
    await ctx.reply('Не удалось распознать номер. Попробуйте еще раз или введите вручную.');
    return;
  }
  const courier = await updateCourier(ctx.from.id, (existing) => ({
    ...existing,
    phone: normalizedPhone,
    awaitingFullName: true
  }));
  ctx.courierProfile = courier;
  ctx.sessionState = { awaitingFullName: true };
  await ctx.reply('Спасибо! Теперь введите ваше ФИО одной строкой.');
  persistSession(ctx);
}

export async function handleText(ctx: BotContext): Promise<void> {
  attachSession(ctx);
  if (!ctx.from || !ctx.sessionState?.awaitingFullName) {
    return;
  }
  if (!ctx.message || !('text' in ctx.message)) return;
  const raw = ctx.message.text;
  if (!raw) return;
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
}

export async function handleCardsRequest(ctx: BotContext): Promise<void> {
  if (!ctx.from) return;
  const courier = await listCourierCards(ctx.from.id);
  if (!courier) {
    await ctx.reply('Вы еще не зарегистрированы. Используйте /start.');
    return;
  }
  const lastCards = Object.values(courier.lastCards).flat().sort((a, b) => dayjs(b.uploadedAt).valueOf() - dayjs(a.uploadedAt).valueOf());
  if (!lastCards.length) {
    await ctx.reply('У вас пока нет карточек. Обратитесь к администратору.');
    return;
  }
  for (const card of lastCards.slice(0, 5)) {
    await ctx.reply(formatCard(card));
  }
}

import { attachSession, persistSession } from '../session.js';
import { getOrCreateCourier, updateCourier, getCourier } from '../../services/courierService.js';
import { isAdmin } from '../../services/adminService.js';
import { normalizePhone } from '../../utils/phone.js';
import { normalizeFullName } from '../../utils/name.js';
import { writeAuditLog } from '../../utils/logger.js';
import { upsertUser, markTaskRequest } from '../../storage/usersStore.js';
import { searchLatestTasks } from '../../services/task-search.js';
import { buildTaskCard } from '../messages/taskCard.js';
import { createCourierStartKeyboard, REGISTRATION_HINT_LABEL, FULL_NAME_HINT_LABEL, ADMIN_MODE_HINT_LABEL } from '../keyboards/courier.js';
function collectProfile(ctx) {
    if (!ctx.from)
        return {};
    return {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
    };
}

function resolveCourierStatus(courier) {
    const hasPhone = Boolean(courier?.phone);
    const awaitingFullName = Boolean((courier?.awaitingFullName ?? (!courier?.fullName && hasPhone)));
    const isRegistered = hasPhone && !awaitingFullName;
    return { hasPhone, awaitingFullName, isRegistered };
}

async function guardTaskAccess(ctx) {
    if (!ctx.from)
        return { allowed: false };
    const [adminMode, courier] = await Promise.all([
        isAdmin(ctx.from.id),
        getCourier(ctx.from.id)
    ]);
    if (courier) {
        ctx.courierProfile = courier;
    }
    const status = resolveCourierStatus(courier);
    ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: status.awaitingFullName };
    if (adminMode) {
        await ctx.reply('Похоже, вы используете режим администратора. Курьерские задания в нём недоступны. Используйте /get_admin для выгрузок или выйдите из админ-режима.');
        return { allowed: false, status, adminMode };
    }
    if (!status.hasPhone) {
        await ctx.reply('Мне нужен ваш номер телефона, чтобы подобрать задания. Нажмите /start и поделитесь контактом.');
        return { allowed: false, status, adminMode };
    }
    if (status.awaitingFullName) {
        await ctx.reply('Почти готово! Напишите ваше ФИО одной строкой, чтобы я смог подключить вас к заданиям.');
        return { allowed: false, status, adminMode };
    }
    return { allowed: true, status, adminMode, courier };
}
async function deliverLatestTasks(ctx, options = {}) {
    if (!ctx.from)
        return;
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
            await ctx.reply('Похоже, вы ещё не зарегистрированы. Нажмите /start и отправьте номер телефона, я помогу. 🙂');
        }
        return;
    }
    if (!result.cards.length) {
        if (notifyWhenEmpty) {
            await ctx.reply('Пока актуальных заданий нет. Загляните чуть позже, я продолжу искать. ⏳');
        }
        return;
    }
    const intro = result.cards.length > 1
        ? `Вот что нашёл для вас: ${result.cards.length} последних заданий. 📋`
        : 'Вот актуальное задание для вас. 📋';
    await ctx.reply(intro);
    for (const card of result.cards) {
        const { text, options } = buildTaskCard(card);
        await ctx.reply(text, options);
    }
}
async function handlePhoneSubmission(ctx, rawPhone, options) {
    attachSession(ctx);
    if (!ctx.from)
        return;
    const normalizedPhone = normalizePhone(rawPhone);
    if (!normalizedPhone) {
        await ctx.reply('Упс, не распознал номер. Проверьте формат 8XXXXXXXXXX и попробуйте снова. 📞');
        return;
    }
    const adminMode = await isAdmin(ctx.from.id);
    const profile = collectProfile(ctx);
    const awaitingFullName = Boolean(ctx.sessionState?.awaitingFullName || !ctx.courierProfile?.fullName);
    const courier = await getOrCreateCourier(ctx.from.id, {
        ...profile,
        phone: normalizedPhone,
        awaitingFullName
    });
    ctx.courierProfile = courier;
    const status = resolveCourierStatus(courier);
    ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: status.awaitingFullName };
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
    const keyboard = createCourierStartKeyboard({
        isRegistered: status.isRegistered,
        isAdmin: adminMode,
        awaitingFullName: status.awaitingFullName
    });
    if (status.awaitingFullName) {
        await ctx.reply('Спасибо! ✍️ Напишите, пожалуйста, ваше ФИО одной строкой.', keyboard);
    }
    else {
        await ctx.reply('Номер сохранён. 🔍 Ищу ваше последнее задание…', keyboard);
    }
    persistSession(ctx);
    if (status.isRegistered && !adminMode) {
        await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'auto' });
    }
}
export async function handleStart(ctx) {
    attachSession(ctx);
    if (!ctx.from)
        return;
    const profile = collectProfile(ctx);
    const [courier, adminMode] = await Promise.all([
        getOrCreateCourier(ctx.from.id, {
            ...profile
        }),
        isAdmin(ctx.from.id)
    ]);
    ctx.courierProfile = courier;
    const status = resolveCourierStatus(courier);
    ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: status.awaitingFullName };
    await upsertUser({ telegramId: ctx.from.id, ...profile });
    const keyboard = createCourierStartKeyboard({
        isRegistered: status.isRegistered,
        isAdmin: adminMode,
        awaitingFullName: status.awaitingFullName
    });
    let greeting;
    if (adminMode) {
        greeting = 'Привет! 👋 Сейчас активирован режим администратора. Курьерские задания в нём недоступны — используйте /get_admin для работы с выгрузками.';
    }
    else if (!status.hasPhone) {
        greeting = 'Привет! 👋 Поделитесь номером через кнопку ниже или отправьте его в формате 8XXXXXXXXXX, и я подключу вас к заданиям.';
    }
    else if (status.awaitingFullName) {
        greeting = 'Привет! 👋 Осталось написать ваше ФИО одной строкой, чтобы я мог подобрать задания.';
    }
    else {
        greeting = 'Привет! 👋 Нажмите «Получить последнее задание», чтобы увидеть актуальную карточку.';
    }
    await ctx.reply(greeting, keyboard);
    persistSession(ctx);
}
export async function handleReset(ctx) {
    attachSession(ctx);
    if (!ctx.from)
        return;
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
    await ctx.reply('Готово! 🔁 Данные очищены. Отправьте новый номер телефона и ФИО, когда будете готовы.');
    await writeAuditLog({ name: 'courier.reset', userId: ctx.from.id });
    persistSession(ctx);
}
export async function handleContact(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message || !('contact' in ctx.message))
        return;
    const contact = ctx.message.contact;
    if (contact.user_id && contact.user_id !== ctx.from.id) {
        await ctx.reply('Похоже, контакт с другого номера. Отправьте, пожалуйста, контакт со своего телефона. 📱');
        return;
    }
    await handlePhoneSubmission(ctx, contact.phone_number, { validated: true });
}
export async function handleText(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message || !('text' in ctx.message))
        return;
    const raw = ctx.message.text.trim();
    if (!raw)
        return;
    if (raw === REGISTRATION_HINT_LABEL) {
        await ctx.reply('Чтобы получить задания, поделитесь номером телефона через кнопку или отправьте его в формате 8XXXXXXXXXX.');
        return;
    }
    if (raw === FULL_NAME_HINT_LABEL) {
        await ctx.reply('Напишите, пожалуйста, ваше ФИО одной строкой — например, Иванов Иван Иванович.');
        return;
    }
    if (raw === ADMIN_MODE_HINT_LABEL) {
        await ctx.reply('В режиме администратора я не отправляю курьерские задания. Используйте /get_admin для работы с выгрузками.');
        return;
    }
    if (ctx.sessionState?.awaitingFullName) {
        const fullName = normalizeFullName(raw);
        if (!fullName) {
            await ctx.reply('Не удалось распознать ФИО. Напишите полностью, например: Иванов Иван Иванович.');
            return;
        }
        let courier = ctx.courierProfile;
        if (!courier) {
            courier = await getCourier(ctx.from.id);
        }
        if (courier) {
            courier = await updateCourier(ctx.from.id, (existing) => ({
                ...existing,
                fullName,
                awaitingFullName: false
            }));
        }
        else {
            const profile = collectProfile(ctx);
            courier = await getOrCreateCourier(ctx.from.id, {
                ...profile,
                fullName,
                awaitingFullName: false
            });
        }
        ctx.courierProfile = courier;
        const status = resolveCourierStatus(courier);
        ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: status.awaitingFullName };
        const adminMode = await isAdmin(ctx.from.id);
        const keyboard = createCourierStartKeyboard({
            isRegistered: status.isRegistered,
            isAdmin: adminMode,
            awaitingFullName: status.awaitingFullName
        });
        await ctx.reply(`Спасибо, ${fullName}! ФИО записал. 🔍 Проверяю задания…`, keyboard);
        persistSession(ctx);
        await writeAuditLog({
            name: 'courier.onboarding_complete',
            userId: ctx.from.id,
            phone: courier?.phone,
            details: { fullName }
        });
        await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'onboarding' });
        return;
    }
    const digitsCount = raw.replace(/\D/g, '').length;
    if (digitsCount >= 10) {
        await handlePhoneSubmission(ctx, raw, { validated: false });
    }
}
export async function handleCardsRequest(ctx) {
    attachSession(ctx);
    if (!ctx.from)
        return;
    const access = await guardTaskAccess(ctx);
    if (!access.allowed) {
        persistSession(ctx);
        return;
    }
    persistSession(ctx);
    await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'command' });
}
export async function handleLastTaskButton(ctx) {
    attachSession(ctx);
    if (!ctx.from)
        return;
    const access = await guardTaskAccess(ctx);
    if (!access.allowed) {
        persistSession(ctx);
        return;
    }
    persistSession(ctx);
    await deliverLatestTasks(ctx, { notifyWhenEmpty: true, limit: 5, reason: 'button' });
}

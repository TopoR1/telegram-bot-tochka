import { Markup } from 'telegraf';
import { attachSession, persistSession } from './session.js';
import { getOrCreateAdmin, isAdmin } from '../services/adminService.js';
import { writeAuditLog, logError } from '../utils/logger.js';
import { replyWithLimitedText } from '../utils/telegram.js';
import { listGroupBindings, saveGroupBinding, recordAnnouncement } from '../services/group-announcements.js';
import { handleAdminUpload } from './handlers/adminUpload.js';
import { JsonValidationError } from '../storage/jsonStore.js';
import { getCourier } from '../services/courierService.js';
import { createCourierStartKeyboard } from './keyboards/courier.js';
import { UnknownInputError, UNKNOWN_INPUT_MESSAGE } from './errors.js';

function resolveCourierStatus(courier) {
    const hasPhone = Boolean(courier?.phone);
    const awaitingFullName = Boolean((courier?.awaitingFullName ?? (!courier?.fullName && hasPhone)));
    const isRegistered = hasPhone && !awaitingFullName;
    return { hasPhone, awaitingFullName, isRegistered };
}
export async function handleGetAdmin(ctx) {
    attachSession(ctx);
    if (!ctx.from)
        return;
    const admin = await getOrCreateAdmin(ctx.from.id, {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
    });
    ctx.adminProfile = admin;
    await ctx.reply('Вы зарегистрированы как администратор. Отправьте .xlsx файл с карточками.', Markup.removeKeyboard());
    persistSession(ctx);
}
async function clearTopicSelectionKeyboard(ctx) {
    try {
        await ctx.editMessageReplyMarkup(undefined);
    }
    catch (err) {
        if (process.env.DEBUG) {
            console.warn('Failed to clear topic keyboard', err);
        }
    }
}
async function finalizeGroupBinding(ctx, binding, mode) {
    const updatedBindings = await saveGroupBinding(ctx.from.id, binding);
    if (ctx.adminProfile) {
        ctx.adminProfile = { ...ctx.adminProfile, groupBindings: updatedBindings };
    }
    const details = {
        chatId: binding.chatId,
        mode
    };
    if (binding.messageThreadId !== undefined) {
        details.messageThreadId = binding.messageThreadId;
    }
    ctx.sessionState = {
        ...(ctx.sessionState ?? {}),
        awaitingTopicSelection: false,
        pendingGroupBinding: undefined
    };
    await writeAuditLog({ name: 'admin.bind_group', userId: ctx.from.id, details });
    const suffix = binding.messageThreadId !== undefined
        ? ' Бот будет публиковать анонсы в выбранной теме.'
        : ' Бот будет публиковать анонсы в основном чате.';
    await ctx.reply(`Чат «${binding.title}» сохранен.${suffix} Используйте /announce, чтобы отправить сообщение.`);
    persistSession(ctx);
}
export async function handleBindGroupSelection(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.callbackQuery || !('data' in ctx.callbackQuery))
        return false;
    const data = ctx.callbackQuery.data;
    if (!data?.startsWith('bind:')) {
        return false;
    }
    if (!ctx.sessionState?.pendingGroupBinding) {
        await ctx.answerCbQuery('Данные для привязки не найдены. Повторите /bind_group.');
        return true;
    }
    const pending = ctx.sessionState.pendingGroupBinding;
    const action = data.slice('bind:'.length);
    try {
        switch (action) {
            case 'use_forwarded': {
                if (!pending.forwardedThreadId) {
                    await ctx.answerCbQuery('В пересланном сообщении нет темы. Выберите другой вариант.', { show_alert: true });
                    return true;
                }
                await ctx.answerCbQuery('Используем тему из пересланного сообщения.');
                await clearTopicSelectionKeyboard(ctx);
                await finalizeGroupBinding(ctx, {
                    chatId: pending.chatId,
                    title: pending.title,
                    messageThreadId: pending.forwardedThreadId
                }, 'forwarded');
                return true;
            }
            case 'create_topic': {
                try {
                    const created = await ctx.telegram.callApi('createForumTopic', {
                        chat_id: pending.chatId,
                        name: 'Анонсы бота'
                    });
                    const messageThreadId = created.message_thread_id;
                    if (typeof messageThreadId !== 'number') {
                        throw new Error('Telegram не вернул идентификатор темы');
                    }
                    await clearTopicSelectionKeyboard(ctx);
                    await finalizeGroupBinding(ctx, {
                        chatId: pending.chatId,
                        title: pending.title,
                        messageThreadId
                    }, 'created');
                    await ctx.answerCbQuery('Создана новая тема для анонсов.');
                }
                catch (err) {
                    await ctx.answerCbQuery('Не удалось создать тему. Проверьте права администратора.', { show_alert: true });
                    await ctx.reply(`Создать тему не получилось: ${logError(err)}.`);
                }
                return true;
            }
            case 'skip_topic': {
                await ctx.answerCbQuery('Будем публиковать в общем чате.');
                await clearTopicSelectionKeyboard(ctx);
                await finalizeGroupBinding(ctx, {
                    chatId: pending.chatId,
                    title: pending.title
                }, 'skipped');
                return true;
            }
            default:
                await ctx.answerCbQuery('Неизвестная команда.');
                return true;
        }
    }
    finally {
        persistSession(ctx);
    }
}
export async function handleDocument(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message || !('document' in ctx.message))
        return;
    try {
        const adminMode = await isAdmin(ctx.from.id);
        if (!adminMode) {
            const courier = await getCourier(ctx.from.id);
            if (courier) {
                ctx.courierProfile = courier;
            }
            const status = resolveCourierStatus(courier);
            ctx.sessionState = { ...(ctx.sessionState ?? {}), awaitingFullName: status.awaitingFullName };
            const keyboard = createCourierStartKeyboard({
                isRegistered: status.isRegistered,
                isAdmin: false,
                awaitingFullName: status.awaitingFullName
            });
            persistSession(ctx);
            throw new UnknownInputError(UNKNOWN_INPUT_MESSAGE, keyboard);
        }
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
        await handleAdminUpload(ctx, ctx.from.id, {
            fileId: document.file_id,
            fileName: document.file_name ?? undefined
        });
    }
    catch (err) {
        if (err instanceof JsonValidationError) {
            const lines = [`Не удалось обработать файл: ${err.summary}`];
            if (err.examples.length) {
                lines.push('', 'Первые несоответствия:');
                err.examples.forEach((example) => {
                    lines.push(`• ${example}`);
                });
            }
            if (err.truncated > 0) {
                lines.push(`… и ещё ${err.truncated} ошибок.`);
            }
            if (err.logFilePath) {
                lines.push('', `Полный отчёт: ${err.logFilePath}`);
            }
            await replyWithLimitedText(ctx, lines.join('\n'));
            return;
        }
        await replyWithLimitedText(ctx, `Не удалось обработать файл: ${logError(err)}.`);
    }
}
export async function handleBindGroup(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message)
        return;
    if (!('forward_from_chat' in ctx.message) || !ctx.message.forward_from_chat) {
        await ctx.reply('Перешлите сообщение из нужного чата вместе с этой командой.');
        return;
    }
    const chat = ctx.message.forward_from_chat;
    const chatTitle = 'title' in chat && chat.title ? chat.title : undefined;
    const chatUsername = 'username' in chat && chat.username ? chat.username : undefined;
    const forwardedThreadId = 'is_topic_message' in ctx.message && ctx.message.is_topic_message
        ? ctx.message.message_thread_id ?? undefined
        : undefined;
    const title = chatTitle ?? chatUsername ?? `Чат ${chat.id}`;
    ctx.sessionState = {
        ...(ctx.sessionState ?? {}),
        awaitingTopicSelection: true,
        pendingGroupBinding: {
            chatId: chat.id,
            title,
            forwardedThreadId
        }
    };
    const topicOptions = [
        Markup.button.callback('Использовать тему из пересланного сообщения', 'bind:use_forwarded'),
        Markup.button.callback('Создать новую тему', 'bind:create_topic'),
        Markup.button.callback('Пропустить', 'bind:skip_topic')
    ];
    await ctx.reply([
        `Чат «${title}» найден. Теперь выберите тему для анонсов:`,
        '• Используйте тему из пересланного сообщения, если бот должен писать в существующий тред.',
        '• Создайте новую тему — бот сделает отдельный тред «Анонсы бота».',
        '• Пропустите, если в чате нет тем или хотите писать в общий чат.'
    ].join('\n'), Markup.inlineKeyboard(topicOptions, { columns: 1 }));
    persistSession(ctx);
}
export async function handleAnnounceCommand(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message || !('text' in ctx.message))
        return;
    const messageText = ctx.message.text.replace(/^\/announce\s*/, '');
    const bindings = await listGroupBindings(ctx.from.id);
    if (ctx.adminProfile) {
        ctx.adminProfile = { ...ctx.adminProfile, groupBindings: bindings };
    }
    if (!bindings.length) {
        await ctx.reply('Сначала привяжите группу командой /bind_group, переслав сообщение из нее.');
        return;
    }
    ctx.sessionState = {
        ...(ctx.sessionState ?? {}),
        awaitingAnnouncement: true,
        pendingAnnouncementText: messageText || undefined
    };
    const keyboard = Markup.inlineKeyboard(bindings.map((binding) => Markup.button.callback(binding.title, `announce:${binding.chatId}:${binding.messageThreadId ?? 0}`)));
    await ctx.reply(messageText ? 'Выберите чат для публикации этого анонса.' : 'Выберите чат и отправьте текст анонса.', keyboard);
    persistSession(ctx);
}
export async function handleAnnounceSelection(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.callbackQuery || !('data' in ctx.callbackQuery))
        return false;
    const data = ctx.callbackQuery.data;
    if (!data?.startsWith('announce:'))
        return false;
    const [, chatIdRaw, messageThreadIdRaw] = data.split(':');
    const chatId = Number(chatIdRaw);
    const messageThreadId = Number(messageThreadIdRaw);
    const bindings = await listGroupBindings(ctx.from.id);
    if (ctx.adminProfile) {
        ctx.adminProfile = { ...ctx.adminProfile, groupBindings: bindings };
    }
    const selected = bindings.find((binding) => binding.chatId === chatId && (binding.messageThreadId ?? 0) === messageThreadId);
    if (!selected) {
        await ctx.answerCbQuery('Не удалось найти выбранный чат.');
        return true;
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
    }
    else {
        await ctx.reply(`Отправьте текст анонса для ${selected.title}.`);
    }
    persistSession(ctx);
    return true;
}
export async function handleAnnounceText(ctx) {
    attachSession(ctx);
    if (!ctx.from || !ctx.message || !('text' in ctx.message))
        return;
    if (!ctx.sessionState?.awaitingAnnouncement)
        return;
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
async function sendAnnouncement(ctx, message, target) {
    try {
        await ctx.telegram.sendMessage(target.chatId, message, {
            message_thread_id: target.messageThreadId
        });
        await recordAnnouncement(ctx.from.id, target, message);
        const details = { chatId: target.chatId };
        if (target.messageThreadId !== undefined) {
            details.messageThreadId = target.messageThreadId;
        }
        await writeAuditLog({ name: 'admin.announce', userId: ctx.from.id, details });
        await ctx.reply(`Анонс опубликован в ${target.title}.`);
    }
    catch (err) {
        await ctx.reply(`Не удалось опубликовать анонс: ${logError(err)}.`);
    }
}

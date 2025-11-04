import { Markup } from 'telegraf';
import { fetch } from 'undici';
import { parseXlsx } from '../../services/xlsxParser.js';
import { attachCouriers } from '../../services/courierMatcher.js';
import { broadcastCards } from '../../services/broadcast.js';
import { collectDeliveryReport, formatDeliveryReport, summarizeDeliveryRecords } from '../../services/delivery-report.js';
import { saveAdminTableMetadata } from '../../storage/adminTablesStore.js';
import { updateAdmin } from '../../services/adminService.js';
import { writeAuditLog, logError } from '../../utils/logger.js';
import { listGroupBindings, recordAnnouncement } from '../../services/group-announcements.js';
import { UPLOAD_ANNOUNCEMENT_MESSAGE } from '../messages/adminAnnouncements.js';
async function loadFileBuffer(telegram, fileId) {
    const link = await telegram.getFileLink(fileId);
    const response = await fetch(link.href);
    if (!response.ok) {
        throw new Error('Не удалось загрузить файл из Telegram.');
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
async function publishUploadAnnouncement(ctx, adminId) {
    const bindings = ctx.adminProfile?.groupBindings ?? (await listGroupBindings(adminId));
    if (ctx.adminProfile) {
        ctx.adminProfile = { ...ctx.adminProfile, groupBindings: bindings };
    }
    if (!bindings.length) {
        return;
    }
    const targets = bindings.filter((binding) => binding.messageThreadId !== undefined);
    if (!targets.length) {
        return;
    }
    const me = ctx.botInfo ?? (await ctx.telegram.getMe());
    const botUsername = me.username;
    if (!botUsername) {
        await writeAuditLog({
            name: 'admin.upload_announcement',
            userId: adminId,
            details: { stage: 'resolve_bot_username', error: 'username_not_available' }
        });
        return;
    }
    const keyboard = Markup.inlineKeyboard([
        Markup.button.url('Открыть бота', `https://t.me/${botUsername}`)
    ]);
    for (const target of targets) {
        try {
            await ctx.telegram.sendMessage(target.chatId, UPLOAD_ANNOUNCEMENT_MESSAGE, {
                message_thread_id: target.messageThreadId,
                reply_markup: keyboard.reply_markup
            });
            await recordAnnouncement(adminId, target, UPLOAD_ANNOUNCEMENT_MESSAGE);
            await writeAuditLog({
                name: 'admin.upload_announcement',
                userId: adminId,
                details: {
                    chatId: target.chatId,
                    messageThreadId: target.messageThreadId,
                    status: 'sent'
                }
            });
        }
        catch (err) {
            await writeAuditLog({
                name: 'admin.upload_announcement',
                userId: adminId,
                details: {
                    chatId: target.chatId,
                    messageThreadId: target.messageThreadId,
                    status: 'error',
                    error: logError(err)
                }
            });
        }
    }
}
export async function handleAdminUpload(ctx, adminId, options) {
    const buffer = await loadFileBuffer(ctx.telegram, options.fileId);
    const parsed = await parseXlsx(buffer, adminId);
    await saveAdminTableMetadata(adminId, {
        uploadedAt: parsed.uploadedAt,
        headers: parsed.headers,
        rows: parsed.rows
    });
    const cards = await attachCouriers(adminId, parsed.cards);
    const broadcastResult = await broadcastCards(ctx.telegram, cards);
    const report = (await collectDeliveryReport(adminId, parsed.uploadedAt)) ??
        summarizeDeliveryRecords(adminId, parsed.uploadedAt, broadcastResult.records);
    const reportText = formatDeliveryReport(report);
    await ctx.reply(reportText);
    await updateAdmin(adminId, (existing) => ({
        ...existing,
        lastUploadAt: parsed.uploadedAt
    }));
    if (ctx.adminProfile) {
        ctx.adminProfile = { ...ctx.adminProfile, lastUploadAt: parsed.uploadedAt };
    }
    await writeAuditLog({
        name: 'admin.upload',
        userId: adminId,
        details: {
            file: options.fileName,
            uploadedAt: parsed.uploadedAt,
            total: report.total,
            sent: report.sent,
            skipped: report.skipped,
            errors: report.errors
        }
    });
    await publishUploadAnnouncement(ctx, adminId);
}

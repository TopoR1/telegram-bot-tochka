import dayjs from 'dayjs';
import { formatCard } from '../utils/format.js';
import { recordDispatchedCards } from './dispatch.js';
import { writeAuditLog, logError } from '../utils/logger.js';
export async function broadcastCards(telegram, cards) {
    const now = dayjs().toISOString();
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    for (const card of cards) {
        if (!card.courierTelegramId) {
            card.status = 'skipped';
            card.report = 'Курьер не найден';
            skipped += 1;
            await writeAuditLog({ name: 'delivery.failed', details: { reason: 'no-courier', cardId: card.id } });
            continue;
        }
        try {
            const response = await telegram.sendMessage(card.courierTelegramId, formatCard(card), {
                parse_mode: 'HTML'
            });
            card.status = 'sent';
            card.sentAt = now;
            card.messageId = response.message_id;
            card.chatId = response.chat.id;
            card.report = undefined;
            sent += 1;
            await writeAuditLog({
                name: 'delivery.sent',
                userId: card.courierTelegramId,
                phone: card.courierPhone,
                details: { cardId: card.id, orderId: card.orderId }
            });
        }
        catch (err) {
            card.status = 'error';
            card.report = `Ошибка отправки: ${logError(err)}`;
            errors += 1;
            await writeAuditLog({
                name: 'delivery.failed',
                userId: card.courierTelegramId,
                phone: card.courierPhone,
                details: { cardId: card.id, error: logError(err) }
            });
        }
    }
    const persisted = cards.map((card) => ({ ...card }));
    await recordDispatchedCards(persisted);
    return {
        records: persisted,
        sent,
        skipped,
        errors
    };
}

import dayjs from 'dayjs';
import { Telegram } from 'telegraf';
import { formatCard, formatReportLine } from '../utils/format.js';
import { CourierCard, DeliveryReport } from './types.js';
import { deliveryStore } from '../storage/index.js';
import { writeAuditLog, logError } from '../utils/logger.js';

export interface BroadcastResult extends DeliveryReport {
  reportText: string;
}

export async function broadcastCards(telegram: Telegram, cards: CourierCard[]): Promise<BroadcastResult> {
  const now = dayjs().toISOString();
  const missingCouriers: string[] = [];
  let success = 0;
  let failed = 0;
  for (const card of cards) {
    if (!card.courierTelegramId) {
      card.status = 'failed';
      missingCouriers.push(card.courierPhone ?? card.courierFullName ?? 'неизвестно');
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
      success += 1;
      await writeAuditLog({
        name: 'delivery.sent',
        userId: card.courierTelegramId,
        phone: card.courierPhone,
        details: { cardId: card.id, orderId: card.orderId }
      });
    } catch (err) {
      card.status = 'failed';
      failed += 1;
      await writeAuditLog({
        name: 'delivery.failed',
        userId: card.courierTelegramId,
        phone: card.courierPhone,
        details: { cardId: card.id, error: logError(err) }
      });
    }
  }
  await deliveryStore.update((collection) => {
    collection.push(...cards);
    return collection;
  });
  const total = cards.length;
  const reportLines = cards.map((card) => formatReportLine(card)).join('\n');
  const report: BroadcastResult = {
    adminId: cards[0]?.adminId ?? 0,
    total,
    success,
    failed: failed + missingCouriers.length,
    missingCouriers,
    cards,
    reportText: [`Отправлено: ${success}/${total}`, missingCouriers.length ? `Без курьеров: ${missingCouriers.join(', ')}` : null, '', reportLines].filter(Boolean).join('\n')
  };
  return report;
}

import dayjs from 'dayjs';
import { CourierCard } from '../services/types.js';

export function formatCard(card: CourierCard): string {
  const lines: string[] = [];
  lines.push(`📦 Заказ #${card.orderId ?? '—'}`);
  if (card.customerName) {
    lines.push(`👤 Клиент: ${card.customerName}`);
  }
  if (card.address) {
    lines.push(`📍 Адрес: ${card.address}`);
  }
  if (card.window) {
    lines.push(`⏰ Окно доставки: ${card.window}`);
  }
  if (card.paymentType) {
    lines.push(`💳 Оплата: ${card.paymentType}`);
  }
  if (card.comment) {
    lines.push(`📝 Комментарий: ${card.comment}`);
  }
  lines.push(`Загружено: ${dayjs(card.uploadedAt).format('DD.MM.YYYY HH:mm')}`);
  return lines.join('\n');
}

export function formatReportLine(card: CourierCard): string {
  return [
    `#${card.orderId ?? '—'}`,
    card.courierFullName ?? 'неизвестно',
    card.courierPhone ?? '—',
    card.status ?? 'pending'
  ].join(' | ');
}

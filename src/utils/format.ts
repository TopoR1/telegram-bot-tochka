import dayjs from 'dayjs';
import { CourierCard } from '../services/types.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function formatCurrency(value: number): string {
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
  return formatter.format(value);
}

function formatProfileLink(link: string): string {
  const url = escapeHtmlAttribute(link);
  const display = escapeHtml(link.replace(/^https?:\/\//i, ''));
  return `🔗 <a href="${url}">${display}</a>`;
}

export function formatCard(card: CourierCard): string {
  const lines: string[] = [];
  const fullName = card.courierFullName ?? card.customerName;
  if (fullName) {
    lines.push(`👤 ФИО: ${escapeHtml(fullName)}`);
  }
  if (card.courierPhone) {
    lines.push(`📞 Телефон: ${escapeHtml(card.courierPhone)}`);
  }
  if (typeof card.earningsLastWeek === 'number') {
    lines.push(`💰 Заработок за прошлую неделю: ${formatCurrency(card.earningsLastWeek)} ₽`);
  }
  if (card.profileLink) {
    lines.push(formatProfileLink(card.profileLink));
  }
  lines.push(`📦 Заказ #${escapeHtml(card.orderId ?? '—')}`);
  if (card.address) {
    lines.push(`📍 Адрес: ${escapeHtml(card.address)}`);
  }
  if (card.window) {
    lines.push(`⏰ Окно доставки: ${escapeHtml(card.window)}`);
  }
  if (card.paymentType) {
    lines.push(`💳 Оплата: ${escapeHtml(card.paymentType)}`);
  }
  if (card.comment) {
    lines.push(`📝 Комментарий: ${escapeHtml(card.comment)}`);
  }
  lines.push(`📥 Загружено: ${dayjs(card.uploadedAt).format('DD.MM.YYYY HH:mm')}`);
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

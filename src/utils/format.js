import dayjs from 'dayjs';
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeHtmlAttribute(value) {
    return escapeHtml(value);
}
function formatCurrency(value) {
    const formatter = new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
    return formatter.format(value);
}
function formatTaskLink(link) {
    const url = escapeHtmlAttribute(link);
    const display = escapeHtml(link.replace(/^https?:\/\//i, ''));
    return `🔗 <a href="${url}">${display}</a>`;
}
export function formatCard(card) {
    const lines = [];
    const fullName = card.courierFullName ?? card.customerName;
    if (fullName) {
        lines.push(`👤 ФИО: ${escapeHtml(fullName)}`);
    }
    if (card.courierPhone) {
        lines.push(`📞 Телефон: ${escapeHtml(card.courierPhone)}`);
    }
    if (typeof card.earningsLastWeek === 'number') {
        lines.push(`💰 Сумма выплаты: ${formatCurrency(card.earningsLastWeek)} ₽`);
    }
    if (card.profileLink) {
        lines.push(formatTaskLink(card.profileLink));
    }
    lines.push(`📥 Загружено: ${dayjs(card.uploadedAt).format('DD.MM.YYYY HH:mm')}`);
    return lines.join('\n');
}

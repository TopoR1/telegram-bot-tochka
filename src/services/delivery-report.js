import dayjs from 'dayjs';
import { deliveriesStore } from '../storage/deliveriesStore.js';

/**
 * @typedef {import('./types.js').DeliveryRecord} DeliveryRecord
 * @typedef {import('./types.js').DeliveryStatus} DeliveryStatus
 */

function normalizeReason(record) {
    if (record.report?.trim()) {
        return record.report.trim();
    }
    if (record.status === 'skipped') {
        return 'Курьер не найден';
    }
    if (record.status === 'error') {
        return 'Ошибка отправки';
    }
    return 'Неизвестная причина';
}
/**
 * @param {DeliveryRecord} record
 * @returns {boolean}
 */
function isIssue(record) {
    return record.status === 'skipped' || record.status === 'error';
}
/**
 * @typedef {Object} DeliveryIssue
 * @property {string} id
 * @property {string} [orderId]
 * @property {string} [courierFullName]
 * @property {string} [courierPhone]
 * @property {DeliveryStatus} status
 * @property {string} reason
 */

/**
 * @typedef {Object} DeliverySummary
 * @property {number} adminId
 * @property {string} uploadedAt
 * @property {number} total
 * @property {number} sent
 * @property {number} skipped
 * @property {number} errors
 * @property {DeliveryIssue[]} issues
 */

/**
 * @param {number} adminId
 * @param {string} uploadedAt
 * @param {DeliveryRecord[]} records
 * @returns {DeliverySummary}
 */
export function summarizeDeliveryRecords(adminId, uploadedAt, records) {
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const issues = [];
    records.forEach((record) => {
        if (record.status === 'sent') {
            sent += 1;
            return;
        }
        if (record.status === 'skipped') {
            skipped += 1;
        }
        else if (record.status === 'error') {
            errors += 1;
        }
        if (isIssue(record)) {
            issues.push({
                id: record.id,
                orderId: record.orderId,
                courierFullName: record.courierFullName,
                courierPhone: record.courierPhone,
                status: record.status,
                reason: normalizeReason(record)
            });
        }
    });
    return {
        adminId,
        uploadedAt,
        total: records.length,
        sent,
        skipped,
        errors,
        issues
    };
}
/**
 * @param {number} adminId
 * @param {string} uploadedAt
 * @returns {Promise<DeliverySummary | null>}
 */
export async function collectDeliveryReport(adminId, uploadedAt) {
    const state = await deliveriesStore.read();
    const batch = state.items.history.filter((record) => record.adminId === adminId && record.uploadedAt === uploadedAt);
    if (!batch.length) {
        return null;
    }
    return summarizeDeliveryRecords(adminId, uploadedAt, batch);
}
/**
 * @param {DeliveryIssue[]} issues
 * @returns {string[]}
 */
function collectAffectedCourierNames(issues) {
    const names = issues
        .map((issue) => issue.courierFullName?.trim())
        .filter((name) => Boolean(name));
    return [...new Set(names)];
}
/**
 * @param {DeliverySummary} summary
 * @returns {string}
 */
export function formatDeliveryReport(summary) {
    const uploadedAt = dayjs(summary.uploadedAt).isValid()
        ? dayjs(summary.uploadedAt).format('DD.MM.YYYY HH:mm')
        : summary.uploadedAt;
    const lines = [
        `📊 Отчёт по загрузке от ${uploadedAt}`,
        `Всего строк: ${summary.total}`,
        `Отправлено: ${summary.sent}`,
        `Пропущено: ${summary.skipped}`,
        `Ошибок: ${summary.errors}`
    ];
    if (summary.issues.length) {
        const affected = collectAffectedCourierNames(summary.issues);
        if (affected.length) {
            lines.push('', 'Не получили задания:');
            affected.forEach((name, index) => {
                lines.push(`${index + 1}. ${name}`);
            });
        }
    }
    return lines.join('\n');
}

import dayjs from 'dayjs';
import { deliveriesStore } from '../storage/deliveriesStore.js';
import { DeliveryRecord } from './types.js';

export interface DeliveryIssue {
  id: string;
  orderId?: string;
  courierFullName?: string;
  courierPhone?: string;
  status: 'skipped' | 'error';
  reason: string;
}

export interface DeliveryReportSummary {
  adminId: number;
  uploadedAt: string;
  total: number;
  sent: number;
  skipped: number;
  errors: number;
  issues: DeliveryIssue[];
}

function normalizeReason(record: DeliveryRecord): string {
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

function isIssue(record: DeliveryRecord): record is DeliveryRecord & { status: 'skipped' | 'error' } {
  return record.status === 'skipped' || record.status === 'error';
}

export function summarizeDeliveryRecords(
  adminId: number,
  uploadedAt: string,
  records: DeliveryRecord[]
): DeliveryReportSummary {
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const issues: DeliveryIssue[] = [];

  records.forEach((record) => {
    if (record.status === 'sent') {
      sent += 1;
      return;
    }
    if (record.status === 'skipped') {
      skipped += 1;
    } else if (record.status === 'error') {
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

export async function collectDeliveryReport(
  adminId: number,
  uploadedAt: string
): Promise<DeliveryReportSummary | null> {
  const state = await deliveriesStore.read();
  const batch = state.history.filter(
    (record) => record.adminId === adminId && record.uploadedAt === uploadedAt
  );
  if (!batch.length) {
    return null;
  }

  return summarizeDeliveryRecords(adminId, uploadedAt, batch);
}

function formatIssue(issue: DeliveryIssue, index: number): string {
  const statusLabel = issue.status === 'skipped' ? 'Пропущено' : 'Ошибка';
  const orderLabel = issue.orderId ? `#${issue.orderId}` : issue.id;
  const identityParts = [orderLabel];
  if (issue.courierFullName) {
    identityParts.push(issue.courierFullName);
  }
  if (issue.courierPhone) {
    identityParts.push(issue.courierPhone);
  }
  const identity = identityParts.join(' • ');
  return `${index + 1}. [${statusLabel}] ${identity} — ${issue.reason}`;
}

export function formatDeliveryReport(summary: DeliveryReportSummary): string {
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
    lines.push('', 'Не отправлено:');
    summary.issues.forEach((issue, index) => {
      lines.push(formatIssue(issue, index));
    });
  }
  return lines.join('\n');
}

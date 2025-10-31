import { Telegram } from 'telegraf';
import { BotContext } from '../types.js';
import { ParsedXlsxResult, parseXlsx } from '../../services/xlsxParser.js';
import { attachCouriers } from '../../services/courierMatcher.js';
import { broadcastCards } from '../../services/broadcast.js';
import {
  collectDeliveryReport,
  formatDeliveryReport,
  summarizeDeliveryRecords
} from '../../services/delivery-report.js';
import { saveAdminTableMetadata } from '../../storage/adminTablesStore.js';
import { updateAdmin } from '../../services/adminService.js';
import { writeAuditLog } from '../../utils/logger.js';

interface UploadOptions {
  fileId: string;
  fileName?: string;
}

async function loadFileBuffer(telegram: Telegram, fileId: string): Promise<Buffer> {
  const link = await telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error('Не удалось загрузить файл из Telegram.');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function handleAdminUpload(
  ctx: BotContext,
  adminId: number,
  options: UploadOptions
): Promise<void> {
  const buffer = await loadFileBuffer(ctx.telegram, options.fileId);
  const parsed: ParsedXlsxResult = await parseXlsx(buffer, adminId);
  await saveAdminTableMetadata(adminId, {
    uploadedAt: parsed.uploadedAt,
    headers: parsed.headers
  });

  const cards = await attachCouriers(adminId, parsed.cards);
  const broadcastResult = await broadcastCards(ctx.telegram, cards);

  const report =
    (await collectDeliveryReport(adminId, parsed.uploadedAt)) ??
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
}

import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();

vi.mock('../../../src/utils/http-client.js', () => ({
  fetch: fetchMock
}));

const parseXlsxMock = vi.fn();
vi.mock('../../../src/services/xlsxParser.js', () => ({
  parseXlsx: parseXlsxMock
}));

const attachCouriersMock = vi.fn();
vi.mock('../../../src/services/courierMatcher.js', () => ({
  attachCouriers: attachCouriersMock
}));

const broadcastCardsMock = vi.fn();
vi.mock('../../../src/services/broadcast.js', () => ({
  broadcastCards: broadcastCardsMock
}));

const collectDeliveryReportMock = vi.fn();
const formatDeliveryReportMock = vi.fn();
const summarizeDeliveryRecordsMock = vi.fn();
vi.mock('../../../src/services/delivery-report.js', () => ({
  collectDeliveryReport: collectDeliveryReportMock,
  formatDeliveryReport: formatDeliveryReportMock,
  summarizeDeliveryRecords: summarizeDeliveryRecordsMock
}));

const saveAdminTableMetadataMock = vi.fn();
vi.mock('../../../src/storage/adminTablesStore.js', () => ({
  saveAdminTableMetadata: saveAdminTableMetadataMock
}));

const updateAdminMock = vi.fn();
vi.mock('../../../src/services/adminService.js', () => ({
  updateAdmin: updateAdminMock
}));

const writeAuditLogMock = vi.fn();
const logErrorMock = vi.fn();
vi.mock('../../../src/utils/logger.js', () => ({
  writeAuditLog: writeAuditLogMock,
  logError: logErrorMock
}));

const listGroupBindingsMock = vi.fn();
const recordAnnouncementMock = vi.fn();
vi.mock('../../../src/services/group-announcements.js', () => ({
  listGroupBindings: listGroupBindingsMock,
  recordAnnouncement: recordAnnouncementMock
}));

vi.mock('../../../src/bot/messages/adminAnnouncements.js', () => ({
  UPLOAD_ANNOUNCEMENT_MESSAGE: 'Загрузка завершена'
}));

const { handleAdminUpload } = await import('../../../src/bot/handlers/adminUpload.js');

describe('handleAdminUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('обрабатывает XLSX и отправляет отчет без повторных сообщений', async () => {
    const adminId = 123;
    const uploadTime = new Date('2024-01-01T10:00:00Z');
    const buffer = Buffer.from('mock-file');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(arrayBuffer)
    });

    parseXlsxMock.mockResolvedValue({
      uploadedAt: uploadTime,
      headers: ['A'],
      rows: [[1]],
      cards: [{ id: 'card-1' }]
    });

    attachCouriersMock.mockResolvedValue([{ id: 'card-1', courierId: '42' }]);
    broadcastCardsMock.mockResolvedValue({ records: [{ id: 'card-1', status: 'sent' }] });
    collectDeliveryReportMock.mockResolvedValue(null);
    summarizeDeliveryRecordsMock.mockReturnValue({
      total: 1,
      sent: 1,
      skipped: 0,
      errors: [],
      uploadedAt: uploadTime
    });
    formatDeliveryReportMock.mockReturnValue('Итоговый отчет');
    saveAdminTableMetadataMock.mockResolvedValue();
    updateAdminMock.mockResolvedValue();
    writeAuditLogMock.mockResolvedValue();
    listGroupBindingsMock.mockResolvedValue([]);

    const ctx = {
      telegram: {
        getFileLink: vi.fn().mockResolvedValue(new URL('https://example.com/file.xlsx')),
        sendMessage: vi.fn()
      },
      reply: vi.fn(),
      adminProfile: {
        groupBindings: [
          { chatId: 1, messageThreadId: 10 }
        ]
      },
      botInfo: { username: 'tochka_bot' }
    };

    await handleAdminUpload(ctx, adminId, { fileId: 'file-id', fileName: 'upload.xlsx' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseXlsxMock).toHaveBeenCalledWith(expect.any(Buffer), adminId);
    expect(saveAdminTableMetadataMock).toHaveBeenCalledWith(adminId, expect.objectContaining({
      uploadedAt: uploadTime
    }));
    expect(broadcastCardsMock).toHaveBeenCalledWith(ctx.telegram, [{ id: 'card-1', courierId: '42' }]);
    expect(formatDeliveryReportMock).toHaveBeenCalledWith(expect.objectContaining({
      total: 1,
      sent: 1
    }));
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith('Итоговый отчет');
    expect(ctx.telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(recordAnnouncementMock).toHaveBeenCalledTimes(1);
  });
});

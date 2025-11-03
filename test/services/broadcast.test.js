import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Telegraf } from 'telegraf';

vi.mock('../../src/utils/format.js', () => ({
  formatCard: vi.fn((card) => `<card:${card.id}>`)
}));

vi.mock('../../src/services/dispatch.js', () => ({
  recordDispatchedCards: vi.fn(async () => {})
}));

vi.mock('../../src/utils/logger.js', () => ({
  writeAuditLog: vi.fn(async () => {}),
  logError: vi.fn((err) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err)))
}));

let broadcastCards;
let recordDispatchedCards;
let formatCard;
let writeAuditLog;
let logError;

function createTelegramMock(implementation) {
  const bot = new Telegraf('TEST_TOKEN');
  const sendMessage = vi.spyOn(bot.telegram, 'sendMessage').mockImplementation(implementation);
  return { telegram: bot.telegram, sendMessage };
}

describe('broadcastCards', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ broadcastCards } = await import('../../src/services/broadcast.js'));
    ({ recordDispatchedCards } = await import('../../src/services/dispatch.js'));
    ({ formatCard } = await import('../../src/utils/format.js'));
    ({ writeAuditLog, logError } = await import('../../src/utils/logger.js'));
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends cards to couriers and records dispatch', async () => {
    const { telegram, sendMessage } = createTelegramMock(async (chatId, text) => ({
      message_id: 101,
      chat: { id: chatId },
      text
    }));

    const cards = [
      {
        id: 'card-1',
        adminId: 200,
        orderId: 'ORD-1',
        courierPhone: '89991234567',
        courierTelegramId: 12345,
        uploadedAt: '2024-03-14T10:00:00Z',
        status: 'pending'
      }
    ];

    const result = await broadcastCards(telegram, cards);

    expect(result).toMatchObject({ sent: 1, skipped: 0, errors: 0 });
    expect(cards[0]).toMatchObject({
      status: 'sent',
      sentAt: '2024-03-15T08:00:00.000Z',
      messageId: 101,
      chatId: 12345,
      report: undefined
    });

    expect(sendMessage).toHaveBeenCalledWith(12345, '<card:card-1>', { parse_mode: 'HTML' });
    expect(formatCard).toHaveBeenCalledWith(cards[0]);
    expect(writeAuditLog).toHaveBeenCalledWith({
      name: 'delivery.sent',
      userId: 12345,
      phone: '89991234567',
      details: { cardId: 'card-1', orderId: 'ORD-1' }
    });

    expect(recordDispatchedCards).toHaveBeenCalledTimes(1);
    const persisted = recordDispatchedCards.mock.calls[0][0];
    expect(persisted[0]).not.toBe(cards[0]);
    expect(persisted[0].status).toBe('sent');
  });

  it('skips cards without courier ids', async () => {
    const { telegram, sendMessage } = createTelegramMock(async () => ({ message_id: 1, chat: { id: 1 } }));
    const cards = [
      {
        id: 'card-2',
        adminId: 201,
        courierPhone: '89990001122',
        uploadedAt: '2024-03-14T10:00:00Z',
        status: 'pending'
      }
    ];

    const result = await broadcastCards(telegram, cards);

    expect(result).toMatchObject({ sent: 0, skipped: 1, errors: 0 });
    expect(cards[0].status).toBe('skipped');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith({ name: 'delivery.failed', details: { reason: 'no-courier', cardId: 'card-2' } });
  });

  it('records delivery errors and reports them', async () => {
    const error = new Error('Network down');
    const { telegram, sendMessage } = createTelegramMock(async () => {
      throw error;
    });

    const cards = [
      {
        id: 'card-3',
        adminId: 202,
        courierPhone: '89993332211',
        courierTelegramId: 54321,
        uploadedAt: '2024-03-14T10:00:00Z',
        status: 'pending'
      }
    ];

    const result = await broadcastCards(telegram, cards);

    expect(result).toMatchObject({ sent: 0, skipped: 0, errors: 1 });
    expect(cards[0].status).toBe('error');
    expect(cards[0].report).toBe('Ошибка отправки: Error: Network down');
    expect(logError).toHaveBeenCalledWith(error);
    expect(writeAuditLog).toHaveBeenCalledWith({
      name: 'delivery.failed',
      userId: 54321,
      phone: '89993332211',
      details: { cardId: 'card-3', error: 'Error: Network down' }
    });
    expect(sendMessage).toHaveBeenCalled();
  });
});

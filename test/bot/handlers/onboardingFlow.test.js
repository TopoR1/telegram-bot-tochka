import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import schema from '../../../data/schema.json' assert { type: 'json' };
import { resetVirtualFs, readVirtualFile } from '../../helpers/virtualFs.js';

const dataDir = '/data';
const backupDir = '/backups';
const logDir = '/logs';

vi.mock('../../../src/config.js', () => ({
  appConfig: {
    dataDir,
    backupDir,
    logDir,
    backupRetention: 5,
    schemaFile: '/schema.json'
  },
  resolveDataPath: (...segments) => path.posix.join(dataDir, ...segments),
  resolveBackupPath: (...segments) => path.posix.join(backupDir, ...segments),
  resolveLogPath: (...segments) => path.posix.join(logDir, ...segments)
}));

const markTaskRequestMock = vi.fn();
const upsertUserMock = vi.fn();
const searchLatestTasksMock = vi.fn();
const isAdminMock = vi.fn(async () => false);

vi.mock('../../../src/storage/usersStore.js', () => ({
  upsertUser: upsertUserMock,
  markTaskRequest: markTaskRequestMock
}));

vi.mock('../../../src/services/task-search.js', () => ({
  searchLatestTasks: searchLatestTasksMock
}));

vi.mock('../../../src/services/adminService.js', () => ({
  isAdmin: isAdminMock
}));

function createContext(replies, from) {
  return {
    from,
    reply: vi.fn(async (text, extra) => {
      replies.push({ text, extra });
    })
  };
}

describe('courier onboarding flow', () => {
  const courierId = 7801;
  const from = {
    id: courierId,
    username: 'courier_tester',
    first_name: 'Иван',
    last_name: 'Петров'
  };

  beforeEach(() => {
    vi.resetModules();
    resetVirtualFs({
      '/schema.json': JSON.stringify(schema, null, 2)
    });
    markTaskRequestMock.mockReset();
    upsertUserMock.mockReset();
    searchLatestTasksMock.mockReset();
    isAdminMock.mockReset();
    isAdminMock.mockResolvedValue(false);
  });

  it('keeps stored full name and awaiting flag throughout onboarding', async () => {
    const [{ handleContact, handleText, handleStart }, { getCourier }, { sessionManager }] = await Promise.all([
      import('../../../src/bot/handlers/start.js'),
      import('../../../src/services/courierService.js'),
      import('../../../src/bot/session.js')
    ]);

    sessionManager.reset(courierId);

    searchLatestTasksMock.mockResolvedValue({
      courier: { telegramId: courierId, phone: '89995556677' },
      cards: [],
      normalizedPhone: '89995556677'
    });

    const replies = [];

    const contactCtx = createContext(replies, from);
    contactCtx.message = {
      contact: {
        phone_number: '89995556677',
        user_id: courierId
      }
    };

    await handleContact(contactCtx);

    expect(contactCtx.sessionState.awaitingFullName).toBe(true);

    let courier = await getCourier(courierId);
    expect(courier?.phone).toBe('89995556677');
    expect(courier?.awaitingFullName).toBe(true);
    expect(courier?.fullName).toBeUndefined();

    const fullNameCtx = createContext(replies, from);
    fullNameCtx.message = { text: 'иванов иван' };

    await handleText(fullNameCtx);

    expect(fullNameCtx.sessionState.awaitingFullName).toBe(false);

    courier = await getCourier(courierId);
    expect(courier?.fullName).toBe('Иванов Иван');
    expect(courier?.awaitingFullName).toBe(false);

    const auditRaw = readVirtualFile('/logs/audit.log', 'utf8').trim();
    const auditEvents = auditRaw
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    expect(auditEvents.map((event) => event.name)).toContain('courier.onboarding_complete');

    const taskEvent = auditEvents.find((event) => event.name === 'courier.task_request');
    expect(taskEvent?.details?.reason).toBe('onboarding');

    const thankYouReply = replies.find((reply) => reply.text.includes('ФИО записал'));
    expect(thankYouReply?.text).toContain('ФИО записал');

    const emptyTasksReply = replies.find((reply) => reply.text.includes('Пока актуальных заданий нет'));
    expect(emptyTasksReply).toBeTruthy();

    const startCtx = createContext(replies, from);
    startCtx.message = { text: '/start' };

    await handleStart(startCtx);

    expect(startCtx.sessionState.awaitingFullName).toBe(false);

    courier = await getCourier(courierId);
    expect(courier?.fullName).toBe('Иванов Иван');
    expect(courier?.awaitingFullName).toBe(false);

    const lastReply = replies.at(-1)?.text ?? '';
    expect(lastReply).toContain('Получить последнее задание');
  });
});

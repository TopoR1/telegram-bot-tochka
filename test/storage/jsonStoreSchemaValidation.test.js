import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import schema from '../../data/schema.json' assert { type: 'json' };
import { resetVirtualFs } from '../helpers/virtualFs.js';

const baseDir = '/data';
const backupDir = '/backups';
const logDir = '/logs';

const usersData = {
  version: 2,
  users: [
    {
      telegramId: 101,
      username: 'user101',
      firstName: 'Test',
      lastName: 'User',
      phone: '+79991234567',
      normalizedPhone: '+79991234567',
      phoneValidated: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      lastTaskRequestAt: '2024-01-02T12:00:00Z'
    }
  ]
};

const adminTablesData = {
  version: 2,
  tables: {
    '501': {
      uploadedAt: '2024-01-05T10:00:00Z',
      headers: {
        id: 'ID',
        orderId: 'Order',
        customerName: 'Customer',
        normalizedFullName: null
      },
      rows: [
        {
          id: 'row-1',
          orderId: 'ORDER-1',
          customerName: 'Alice',
          normalizedFullName: 'Alice Smith',
          phone: '+79990000000',
          earningsLastWeek: 1200,
          profileLink: 'https://example.com/profiles/row-1',
          address: 'Main street, 1',
          window: '10:00-12:00',
          paymentType: 'card',
          comment: 'Ring the bell'
        }
      ]
    }
  }
};

const baseDeliveryRecord = {
  id: 'card-1',
  adminId: 700,
  orderId: 'ORDER-1',
  customerName: 'Client One',
  earningsLastWeek: 5400,
  profileLink: 'https://example.com/deliveries/card-1',
  address: 'Example st. 12',
  window: '09:00-12:00',
  paymentType: 'cash',
  comment: 'Leave at reception',
  courierPhone: '+79995554433',
  courierFullName: 'Courier Example',
  courierTelegramId: 900,
  status: 'pending',
  uploadedAt: '2024-01-03T09:00:00Z',
  sentAt: '2024-01-03T09:05:00Z',
  messageId: 321,
  chatId: -100500,
  report: 'scheduled'
};

const courierDeliveryRecord = {
  ...baseDeliveryRecord,
  id: 'card-2',
  orderId: 'ORDER-2',
  uploadedAt: '2024-01-04T10:00:00Z',
  sentAt: '2024-01-04T10:05:00Z',
  report: 'sent'
};

const deliveriesData = {
  version: 2,
  items: {
    history: [baseDeliveryRecord],
    byCourier: {
      '900': [courierDeliveryRecord]
    }
  }
};

const groupBindingsData = {
  version: 2,
  bindings: {
    '501': [
      {
        chatId: -100200300,
        title: 'Logistics',
        messageThreadId: 42
      }
    ]
  }
};

vi.mock('../../src/config.js', async () => ({
  appConfig: {
    dataDir: baseDir,
    backupDir,
    logDir,
    backupRetention: 2,
    schemaFile: '/schema.json'
  },
  resolveDataPath: (...segments) => path.posix.join(baseDir, ...segments),
  resolveBackupPath: (...segments) => path.posix.join(backupDir, ...segments),
  resolveLogPath: (...segments) => path.posix.join(logDir, ...segments)
}));

describe('jsonStore schema integration', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetVirtualFs({
      '/schema.json': JSON.stringify(schema, null, 2),
      '/data/users.json': JSON.stringify(usersData, null, 2),
      '/data/admin_tables.json': JSON.stringify(adminTablesData, null, 2),
      '/data/deliveries.json': JSON.stringify(deliveriesData, null, 2),
      '/data/groupBindings.json': JSON.stringify(groupBindingsData, null, 2)
    });
  });

  it('validates all stores against shared schema', async () => {
    const [usersModule, adminTablesModule, deliveriesModule, groupBindingsModule] = await Promise.all([
      import('../../src/storage/usersStore.js'),
      import('../../src/storage/adminTablesStore.js'),
      import('../../src/storage/deliveriesStore.js'),
      import('../../src/storage/groupBindingsStore.js')
    ]);

    const users = await usersModule.usersStore.read();
    expect(users).toMatchObject({ version: 2 });
    expect(users.users).toHaveLength(1);
    expect(users.users[0].telegramId).toBe(101);

    const adminTables = await adminTablesModule.adminTablesStore.read();
    expect(Object.keys(adminTables.tables)).toEqual(['501']);
    expect(adminTables.tables['501'].rows).toHaveLength(1);

    const deliveries = await deliveriesModule.deliveriesStore.read();
    expect(deliveries.items.history).toHaveLength(1);
    expect(Object.keys(deliveries.items.byCourier)).toEqual(['900']);
    expect(deliveries.items.byCourier['900']).toHaveLength(1);

    const groupBindings = await groupBindingsModule.groupBindingsStore.read();
    expect(Object.keys(groupBindings.bindings)).toEqual(['501']);
    expect(groupBindings.bindings['501']).toHaveLength(1);
    expect(groupBindings.bindings['501'][0]).toMatchObject({ chatId: -100200300, title: 'Logistics' });
  });
});

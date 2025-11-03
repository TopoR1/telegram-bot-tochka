import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { resetVirtualFs, listVirtualDir, readVirtualFile } from '../helpers/virtualFs.js';

vi.mock('../../src/config.js', async () => {
  const baseDir = '/data';
  const backupDir = '/backups';
  const logDir = '/logs';
  return {
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
  };
});

describe('deliveriesStore', () => {
  let deliveriesStore;
  let recordDeliveries;
  let getCourierDeliveries;
  let getDeliveryHistory;

  beforeEach(async () => {
    vi.resetModules();
    resetVirtualFs({
      '/schema.json': JSON.stringify({
        stores: {
          deliveries: {
            type: 'object',
            properties: {
              version: { const: 2 },
              items: {
                type: 'object',
                properties: {
                  history: { type: 'array', items: { type: 'object' } },
                  byCourier: {
                    type: 'object',
                    additionalProperties: { type: 'array', items: { type: 'object' } }
                  }
                },
                required: ['history', 'byCourier'],
                additionalProperties: false
              }
            },
            required: ['version', 'items'],
            additionalProperties: false
          }
        }
      })
    });

    ({ deliveriesStore, recordDeliveries, getCourierDeliveries, getDeliveryHistory } = await import('../../src/storage/deliveriesStore.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records deliveries, updates history and backups', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-10T10:00:00Z'));

    await deliveriesStore.read();

    const baseRecord = {
      id: 'card-1',
      adminId: 100,
      orderId: 'A-1',
      customerName: 'Client',
      courierFullName: 'Courier A',
      courierTelegramId: 500,
      courierPhone: '89991234567',
      uploadedAt: '2024-02-10T09:00:00Z',
      status: 'pending'
    };

    const secondRecord = {
      ...baseRecord,
      id: 'card-2',
      orderId: 'A-2',
      courierTelegramId: 600,
      courierPhone: '89997654321'
    };

    await recordDeliveries([baseRecord, secondRecord]);

    const history = await getDeliveryHistory();
    expect(history.map((item) => item.id)).toEqual(['card-1', 'card-2']);

    const courierHistory = await getCourierDeliveries(500);
    expect(courierHistory).toHaveLength(1);
    expect(courierHistory[0].id).toBe('card-1');

    const backups = listVirtualDir('/backups').filter((name) => name.startsWith('deliveries.json.'));
    expect(backups.length).toBe(1);
    const backupContent = JSON.parse(readVirtualFile(`/backups/${backups[0]}`, 'utf8'));
    expect(backupContent.items.history).toHaveLength(0);

    const thirdRecord = {
      ...baseRecord,
      id: 'card-3',
      courierTelegramId: 500,
      orderId: 'A-3',
      courierPhone: '89990001122',
      uploadedAt: '2024-02-10T11:00:00Z'
    };

    await recordDeliveries([thirdRecord]);

    const courierAfter = await getCourierDeliveries(500);
    expect(courierAfter.map((item) => item.id)).toEqual(['card-3', 'card-1']);

    const updatedBackups = listVirtualDir('/backups').filter((name) => name.startsWith('deliveries.json.'));
    expect(updatedBackups.length).toBeLessThanOrEqual(2);
  });
});

import { JsonStore } from './jsonStore.js';
import { DeliveryRecord } from '../services/types.js';

export interface DeliveriesState {
  history: DeliveryRecord[];
  byCourier: Record<string, DeliveryRecord[]>;
}

const PER_COURIER_LIMIT = 50;

function cloneRecord(record: DeliveryRecord): DeliveryRecord {
  return { ...record };
}

function parseTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortDeliveries(records: DeliveryRecord[]): DeliveryRecord[] {
  return [...records].sort((a, b) => {
    const left = parseTimestamp(a.sentAt ?? a.uploadedAt);
    const right = parseTimestamp(b.sentAt ?? b.uploadedAt);
    return right - left;
  });
}

export const deliveriesStore = new JsonStore<DeliveriesState>({
  name: 'deliveries',
  schemaKey: 'deliveries',
  defaultValue: () => ({ history: [], byCourier: {} })
});

export async function recordDeliveries(records: DeliveryRecord[]): Promise<void> {
  if (!records.length) {
    return;
  }
  const normalized = records.map(cloneRecord);
  await deliveriesStore.update((state) => {
    const nextHistory = [...state.history, ...normalized];
    const nextByCourier = { ...state.byCourier };

    for (const record of normalized) {
      const courierId = record.courierTelegramId;
      if (!courierId) continue;
      const key = courierId.toString();
      const existing = nextByCourier[key] ?? [];
      const filtered = existing.filter((item) => item.id !== record.id);
      const appended = sortDeliveries([...filtered, record]).slice(0, PER_COURIER_LIMIT);
      nextByCourier[key] = appended;
    }

    return { history: nextHistory, byCourier: nextByCourier };
  });
}

export async function getCourierDeliveries(telegramId: number): Promise<DeliveryRecord[]> {
  const state = await deliveriesStore.read();
  const records = state.byCourier[telegramId.toString()] ?? [];
  return sortDeliveries(records);
}

export async function getDeliveryHistory(): Promise<DeliveryRecord[]> {
  const state = await deliveriesStore.read();
  return sortDeliveries(state.history);
}

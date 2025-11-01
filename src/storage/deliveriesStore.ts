import { JsonStore } from './jsonStore.js';
import { DeliveryRecord } from '../services/types.js';

export interface DeliveriesState {
  history: DeliveryRecord[];
  byCourier: Record<string, DeliveryRecord[]>;
}

const DELIVERIES_STORE_VERSION = 1;

export interface DeliveriesStoreData {
  version: number;
  items: DeliveriesState;
}

const PER_COURIER_LIMIT = 50;

function cloneRecord(record: DeliveryRecord): DeliveryRecord {
  return { ...record };
}

function isDeliveryRecord(value: unknown): value is DeliveryRecord {
  return Boolean(value) && typeof value === 'object';
}

function isDeliveriesState(value: unknown): value is DeliveriesState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.history) || typeof data.byCourier !== 'object' || !data.byCourier || Array.isArray(data.byCourier)) {
    return false;
  }
  const historyValid = (data.history as unknown[]).every(isDeliveryRecord);
  const byCourierValid = Object.values(data.byCourier as Record<string, unknown>).every(
    (items) => Array.isArray(items) && items.every(isDeliveryRecord)
  );
  return historyValid && byCourierValid;
}

function isDeliveriesStoreData(value: unknown): value is DeliveriesStoreData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return data.version === DELIVERIES_STORE_VERSION && isDeliveriesState(data.items);
}

function cloneDeliveriesState(state: DeliveriesState): DeliveriesState {
  return {
    history: state.history.map(cloneRecord),
    byCourier: Object.fromEntries(
      Object.entries(state.byCourier).map(([key, items]) => [key, items.map(cloneRecord)])
    )
  };
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

export const deliveriesStore = new JsonStore<DeliveriesStoreData>({
  name: 'deliveries',
  schemaKey: 'deliveries',
  defaultValue: () => ({ version: DELIVERIES_STORE_VERSION, items: { history: [], byCourier: {} } }),
  migrate: (raw) => {
    if (isDeliveriesStoreData(raw)) {
      return { data: { version: DELIVERIES_STORE_VERSION, items: cloneDeliveriesState(raw.items) }, migrated: false };
    }

    if (isDeliveriesState(raw)) {
      return { data: { version: DELIVERIES_STORE_VERSION, items: cloneDeliveriesState(raw) }, migrated: true };
    }

    throw new Error('Unsupported deliveries store format');
  }
});

export async function recordDeliveries(records: DeliveryRecord[]): Promise<void> {
  if (!records.length) {
    return;
  }
  const normalized = records.map(cloneRecord);
  await deliveriesStore.update((state) => {
    const nextHistory = [...state.items.history, ...normalized];
    const nextByCourier = { ...state.items.byCourier };

    for (const record of normalized) {
      const courierId = record.courierTelegramId;
      if (!courierId) continue;
      const key = courierId.toString();
      const existing = nextByCourier[key] ?? [];
      const filtered = existing.filter((item) => item.id !== record.id);
      const appended = sortDeliveries([...filtered, record]).slice(0, PER_COURIER_LIMIT);
      nextByCourier[key] = appended;
    }

    return {
      version: DELIVERIES_STORE_VERSION,
      items: {
        history: nextHistory,
        byCourier: nextByCourier
      }
    };
  });
}

export async function getCourierDeliveries(telegramId: number): Promise<DeliveryRecord[]> {
  const state = await deliveriesStore.read();
  const records = state.items.byCourier[telegramId.toString()] ?? [];
  return sortDeliveries(records);
}

export async function getDeliveryHistory(): Promise<DeliveryRecord[]> {
  const state = await deliveriesStore.read();
  return sortDeliveries(state.items.history);
}

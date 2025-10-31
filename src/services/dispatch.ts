import { DeliveryRecord } from './types.js';
import {
  getCourierDeliveries,
  getDeliveryHistory,
  recordDeliveries
} from '../storage/deliveriesStore.js';

export async function recordDispatchedCards(records: DeliveryRecord[]): Promise<void> {
  await recordDeliveries(records);
}

export async function fetchCourierDeliveries(
  telegramId: number,
  limit?: number
): Promise<DeliveryRecord[]> {
  const deliveries = await getCourierDeliveries(telegramId);
  if (typeof limit === 'number') {
    return deliveries.slice(0, Math.max(limit, 0));
  }
  return deliveries;
}

export async function listDeliveryHistory(): Promise<DeliveryRecord[]> {
  return getDeliveryHistory();
}

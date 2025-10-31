import { courierStore } from '../storage/index.js';
import { CourierCard, CourierRecord } from './types.js';
import { getUser } from '../storage/usersStore.js';
import { normalizePhone } from '../utils/phone.js';
import { fetchCourierDeliveries } from './dispatch.js';

export interface TaskSearchParams {
  telegramId: number;
  limit?: number;
}

export interface TaskSearchResult {
  courier?: CourierRecord;
  cards: CourierCard[];
  normalizedPhone?: string;
}

function deduplicateCards(cards: CourierCard[]): CourierCard[] {
  const seen = new Set<string>();
  const result: CourierCard[] = [];
  for (const card of cards) {
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}

export async function searchLatestTasks({ telegramId, limit = 5 }: TaskSearchParams): Promise<TaskSearchResult> {
  const [couriers, user, deliveries] = await Promise.all([
    courierStore.read(),
    getUser(telegramId),
    fetchCourierDeliveries(telegramId)
  ]);

  const normalizedPhone = user?.normalizedPhone;
  let courier = couriers[telegramId.toString()];

  if (!courier && normalizedPhone) {
    const target = normalizePhone(normalizedPhone);
    if (target) {
      const found = Object.values(couriers).find((candidate) => {
        if (!candidate.phone) return false;
        return normalizePhone(candidate.phone) === target;
      });
      if (found) {
        courier = found;
      }
    }
  }

  if (!courier) {
    return { cards: [], normalizedPhone };
  }

  const unique = deduplicateCards(deliveries).slice(0, limit);
  return {
    courier,
    cards: unique,
    normalizedPhone: normalizedPhone ?? normalizePhone(courier.phone) ?? undefined
  };
}

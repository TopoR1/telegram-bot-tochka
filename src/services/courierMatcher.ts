import dayjs from 'dayjs';
import { courierStore } from '../storage/index.js';
import { CourierCard, CourierRecord } from './types.js';
import { scorePhoneMatch } from '../utils/phone.js';
import {
  findCourierByPhone,
  findCourierByFullName,
  getCourierDisplayName
} from './matching.js';

function getBestCandidate(collection: Record<string, CourierRecord>, card: CourierCard): CourierRecord | undefined {
  const byPhone = findCourierByPhone(collection, card.courierPhone);
  if (byPhone) return byPhone;
  if (!card.courierPhone) {
    const byName = findCourierByFullName(collection, card.courierFullName ?? card.customerName);
    if (byName) return byName;
  }
  if (card.courierPhone) {
    let best: CourierRecord | undefined;
    let bestScore = 0;
    for (const courier of Object.values(collection)) {
      if (!courier.phone) continue;
      const score = scorePhoneMatch(card.courierPhone, courier.phone);
      if (score > bestScore) {
        best = courier;
        bestScore = score;
      }
    }
    if (bestScore > 0.6) {
      return best;
    }
  }
  return undefined;
}

export async function attachCouriers(adminId: number, cards: CourierCard[]): Promise<CourierCard[]> {
  const couriers = await courierStore.read();
  const now = dayjs().toISOString();
  const updated: CourierCard[] = [];
  for (const card of cards) {
    const candidate = getBestCandidate(couriers, card);
    if (candidate) {
      card.courierTelegramId = candidate.telegramId;
      card.courierFullName = getCourierDisplayName(candidate);
      card.courierPhone = candidate.phone ?? card.courierPhone;
      card.status = 'pending';
      candidate.lastCards[adminId.toString()] = [
        ...(candidate.lastCards[adminId.toString()] ?? []),
        card
      ].slice(-50);
      if (!candidate.adminIds.includes(adminId)) {
        candidate.adminIds.push(adminId);
      }
      candidate.updatedAt = now;
      couriers[candidate.telegramId.toString()] = candidate;
    }
    updated.push(card);
  }
  await courierStore.write(couriers);
  return updated;
}

export async function rememberCourierProfile(profile: CourierRecord): Promise<void> {
  await courierStore.update((collection) => {
    collection[profile.telegramId.toString()] = profile;
    return collection;
  });
}

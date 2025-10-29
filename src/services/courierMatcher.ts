import dayjs from 'dayjs';
import { courierStore } from '../storage/index.js';
import { CourierCard, CourierRecord } from './types.js';
import { comparePhones, normalizePhone, scorePhoneMatch } from '../utils/phone.js';
import { normalizeFullName } from '../utils/name.js';

function findByPhone(collection: Record<string, CourierRecord>, phone?: string): CourierRecord | undefined {
  if (!phone) return undefined;
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return Object.values(collection).find((courier) => comparePhones(courier.phone, normalized));
}

function findByName(collection: Record<string, CourierRecord>, fullName?: string): CourierRecord | undefined {
  if (!fullName) return undefined;
  const normalized = normalizeFullName(fullName);
  return Object.values(collection).find((courier) => courier.fullName && normalizeFullName(courier.fullName) === normalized);
}

function getBestCandidate(collection: Record<string, CourierRecord>, card: CourierCard): CourierRecord | undefined {
  const byPhone = findByPhone(collection, card.courierPhone);
  if (byPhone) return byPhone;
  const byName = findByName(collection, card.courierFullName ?? card.customerName);
  if (byName) return byName;
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
      card.courierFullName = candidate.fullName ?? candidate.firstName ?? candidate.username;
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

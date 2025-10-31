import { CourierCard, CourierRecord } from './types.js';
import { normalizePhone, comparePhones } from '../utils/phone.js';
import { normalizeFullName } from '../utils/name.js';

function normalizeNameForMatching(raw: string): string {
  return normalizeFullName(raw).replace(/\s+/g, ' ').toLowerCase();
}

export function isPhoneEqual(expected?: string, actual?: string): boolean {
  if (!expected || !actual) return false;
  const normalizedExpected = normalizePhone(expected);
  const normalizedActual = normalizePhone(actual);
  if (!normalizedExpected || !normalizedActual) {
    return false;
  }
  return comparePhones(normalizedExpected, normalizedActual);
}

export function isFullNameEqual(expected?: string, actual?: string): boolean {
  if (!expected || !actual) return false;
  return normalizeNameForMatching(expected) === normalizeNameForMatching(actual);
}

export function getCourierDisplayName(courier: CourierRecord): string | undefined {
  return courier.fullName ?? courier.lastName ?? courier.firstName ?? courier.username ?? undefined;
}

export function findCourierByPhone(
  collection: Record<string, CourierRecord>,
  phone?: string
): CourierRecord | undefined {
  if (!phone) return undefined;
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return Object.values(collection).find((courier) => courier.phone && isPhoneEqual(normalized, courier.phone));
}

export function findCourierByFullName(
  collection: Record<string, CourierRecord>,
  fullName?: string
): CourierRecord | undefined {
  if (!fullName) return undefined;
  const normalized = normalizeNameForMatching(fullName);
  return Object.values(collection).find((courier) => {
    if (!courier.fullName) return false;
    return normalizeNameForMatching(courier.fullName) === normalized;
  });
}

export function findBestCourierMatch(
  collection: Record<string, CourierRecord>,
  card: CourierCard
): CourierRecord | undefined {
  const byPhone = findCourierByPhone(collection, card.courierPhone);
  if (byPhone) {
    return byPhone;
  }
  if (!card.courierPhone) {
    return findCourierByFullName(collection, card.courierFullName ?? card.customerName);
  }
  return undefined;
}

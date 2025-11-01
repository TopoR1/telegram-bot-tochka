import dayjs from 'dayjs';
import { courierStore } from '../storage/index.js';
import { CourierCard, CourierRecord, DeliveryRecord } from './types.js';
import { getUser, UserRecord } from '../storage/usersStore.js';
import { normalizePhone } from '../utils/phone.js';
import { fetchCourierDeliveries, recordDispatchedCards } from './dispatch.js';
import { AdminTableRow, AdminTablesCollection, listAdminTables } from '../storage/adminTablesStore.js';
import { normalizeFullName } from '../utils/name.js';

export interface TaskSearchParams {
  telegramId: number;
  limit?: number;
}

export interface TaskSearchResult {
  courier?: CourierRecord;
  cards: CourierCard[];
  normalizedPhone?: string;
}

interface MatchedTableRow {
  adminId: number;
  row: AdminTableRow;
  uploadedAt: string;
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

function normalizeNameKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  const normalized = normalizeFullName(raw).trim();
  if (!normalized) return undefined;
  return normalized.replace(/\s+/g, ' ').toLowerCase();
}

function collectNameCandidates(courier?: CourierRecord, user?: UserRecord): string[] {
  const candidates = new Set<string>();
  if (courier?.fullName) {
    candidates.add(courier.fullName);
  }
  if (courier?.lastName || courier?.firstName) {
    const lastFirst = [courier.lastName, courier.firstName].filter(Boolean).join(' ').trim();
    if (lastFirst) {
      candidates.add(lastFirst);
    }
    const firstLast = [courier.firstName, courier.lastName].filter(Boolean).join(' ').trim();
    if (firstLast) {
      candidates.add(firstLast);
    }
  }
  if (user) {
    const lastFirst = [user.lastName, user.firstName].filter(Boolean).join(' ').trim();
    if (lastFirst) {
      candidates.add(lastFirst);
    }
    const firstLast = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (firstLast) {
      candidates.add(firstLast);
    }
  }
  return Array.from(candidates);
}

function collectSortedRows(collection: AdminTablesCollection): MatchedTableRow[] {
  return Object.entries(collection)
    .map(([adminId, metadata]) => ({
      adminId: Number(adminId),
      uploadedAt: metadata.uploadedAt,
      rows: metadata.rows
    }))
    .sort((a, b) => {
      const left = Date.parse(a.uploadedAt) || 0;
      const right = Date.parse(b.uploadedAt) || 0;
      return right - left;
    })
    .flatMap((entry) =>
      entry.rows.map((row) => ({ adminId: entry.adminId, uploadedAt: entry.uploadedAt, row }))
    );
}

function findMatchingRow(
  tables: AdminTablesCollection,
  phone?: string,
  normalizedNames: string[] = []
): MatchedTableRow | undefined {
  const sortedRows = collectSortedRows(tables);
  if (phone) {
    const byPhone = sortedRows.find((entry) => entry.row.phone && entry.row.phone === phone);
    if (byPhone) {
      return byPhone;
    }
  }
  if (normalizedNames.length) {
    const byName = sortedRows.find(
      (entry) => entry.row.normalizedFullName && normalizedNames.includes(entry.row.normalizedFullName)
    );
    if (byName) {
      return byName;
    }
  }
  return undefined;
}

function buildCardFromRow(
  match: MatchedTableRow,
  courier: CourierRecord,
  phone?: string,
  fallbackName?: string
): CourierCard {
  const uploadedAt = match.uploadedAt;
  const sentAt = dayjs().toISOString();
  const normalizedFallback = fallbackName ? normalizeFullName(fallbackName) : undefined;
  const customerName = match.row.customerName ?? normalizedFallback;
  const card: CourierCard = {
    id: match.row.id,
    adminId: match.adminId,
    orderId: match.row.orderId,
    customerName,
    earningsLastWeek: match.row.earningsLastWeek,
    profileLink: match.row.profileLink,
    address: match.row.address,
    window: match.row.window,
    paymentType: match.row.paymentType,
    comment: match.row.comment,
    courierPhone: match.row.phone ?? phone,
    courierFullName: customerName ?? normalizedFallback,
    courierTelegramId: courier.telegramId,
    uploadedAt,
    status: 'sent',
    sentAt
  };
  return card;
}

export async function searchLatestTasks({ telegramId, limit = 5 }: TaskSearchParams): Promise<TaskSearchResult> {
  const [couriers, user, deliveries, tables] = await Promise.all([
    courierStore.read(),
    getUser(telegramId),
    fetchCourierDeliveries(telegramId),
    listAdminTables()
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

  const searchPhone = normalizedPhone ?? normalizePhone(courier.phone) ?? undefined;
  const nameCandidates = collectNameCandidates(courier, user);
  const normalizedNames = nameCandidates
    .map((name) => normalizeNameKey(name))
    .filter((value): value is string => Boolean(value));

  const match = findMatchingRow(tables, searchPhone, normalizedNames);
  let allDeliveries: CourierCard[] = deliveries;

  if (match) {
    const alreadyDelivered = deliveries.some((card) => card.id === match.row.id);
    if (!alreadyDelivered) {
      const fallbackName = courier.fullName ?? nameCandidates.find(Boolean);
      const card = buildCardFromRow(match, courier, searchPhone, fallbackName);
      const delivery: DeliveryRecord = { ...card };
      await recordDispatchedCards([delivery]);
      allDeliveries = [card, ...deliveries];
    }
  }

  const unique = deduplicateCards(allDeliveries).slice(0, limit);
  return {
    courier,
    cards: unique,
    normalizedPhone: normalizedPhone ?? searchPhone
  };
}

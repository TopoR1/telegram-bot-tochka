import XLSX from 'xlsx';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';
import { CourierCard } from './types.js';
import { normalizeFullName } from '../utils/name.js';
import { normalizePhone } from '../utils/phone.js';
import { saveAdminTableMetadata } from '../storage/adminTablesStore.js';

interface ColumnMapping {
  phone?: number;
  fullName?: number;
  earnings?: number;
  link?: number;
  order?: number;
  address?: number;
  window?: number;
  payment?: number;
  comment?: number;
}

const SYNONYMS: Partial<Record<keyof ColumnMapping, string[]>> = {
  phone: ['телефон', 'phone', 'номер', 'mobile'],
  fullName: ['фио', 'имя', 'courier', 'курьер'],
  earnings: ['заработок', 'выручка', 'доход', 'зарплата', 'income', 'прошлая неделя'],
  link: ['ссылка', 'profile', 'профиль', 'link', 'url'],
  order: ['заказ', 'order', '№', 'номер заказа'],
  address: ['адрес', 'address', 'куда', 'location'],
  window: ['окно', 'время', 'таймслот', 'slot'],
  payment: ['оплата', 'payment', 'тип оплаты'],
  comment: ['комментарий', 'примечание', 'коммент', 'comment']
};

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D+/g, '');
  return digits.length >= 10;
}

function looksLikeFullName(value: string): boolean {
  return /\p{L}+\s+\p{L}+/u.test(value);
}

function looksLikeMoney(value: string): boolean {
  const cleaned = value.replace(/[\s\u00A0]/g, '');
  if (!/\d/.test(cleaned)) {
    return false;
  }
  return /(₽|руб|руб\.|rub|р\b)/i.test(value) || /\d{3}/.test(cleaned);
}

function looksLikeLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^@/.test(trimmed)) return true;
  return /(vk\.com|t\.me|telegram\.me|ok\.ru|instagram\.com|facebook\.com|^www\.|\.[a-z]{2,}$)/i.test(trimmed);
}

function normalizeMoney(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).replace(/[\s\u00A0]/g, '').trim();
  if (!value) return undefined;
  const digits = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
  if (!digits) return undefined;
  const dotCount = (digits.match(/\./g) ?? []).length;
  let normalized = digits;
  if (dotCount > 1) {
    const lastDot = digits.lastIndexOf('.');
    const integer = digits.slice(0, lastDot).replace(/\./g, '');
    const fractional = digits.slice(lastDot + 1);
    normalized = fractional ? `${integer}.${fractional}` : integer;
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return undefined;
  return Number(parsed.toFixed(2));
}

function normalizeLink(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let value = String(raw).trim();
  if (!value) return undefined;
  value = value.replace(/[\s\u00A0]+/g, '');
  value = value.replace(/[.,;]+$/g, '');
  if (!value) return undefined;
  if (/^@/.test(value)) {
    return `https://t.me/${value.slice(1)}`;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (/^\/\//.test(value)) {
    return `https:${value}`;
  }
  if (/[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

function detectColumns(headerRow: string[], dataRows: string[][]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  const normalizedHeaders = headerRow.map((header) => header?.toLowerCase?.().trim?.() ?? '');

  (Object.keys(SYNONYMS) as (keyof ColumnMapping)[]).forEach((key) => {
    const synonyms = SYNONYMS[key];
    if (!synonyms?.length) return;
    const index = normalizedHeaders.findIndex((header, idx) => {
      if (used.has(idx)) return false;
      return synonyms.some((synonym) => header.includes(synonym));
    });
    if (index >= 0) {
      mapping[key] = index;
      used.add(index);
    }
  });

  const columnCount = headerRow.length;
  const getValues = (col: number): string[] =>
    dataRows
      .map((row) => (row[col] !== undefined && row[col] !== null ? String(row[col]) : ''))
      .filter((value) => value.trim() !== '');

  const findColumn = (predicate: (values: string[]) => boolean): number | undefined => {
    for (let col = 0; col < columnCount; col += 1) {
      if (used.has(col)) continue;
      const values = getValues(col);
      if (!values.length) continue;
      if (predicate(values)) {
        used.add(col);
        return col;
      }
    }
    return undefined;
  };

  if (mapping.phone === undefined) {
    const byPhone = findColumn((values) => values.some(looksLikePhone));
    if (byPhone !== undefined) {
      mapping.phone = byPhone;
    }
  }

  if (mapping.fullName === undefined) {
    const byName = findColumn((values) => values.some(looksLikeFullName));
    if (byName !== undefined) {
      mapping.fullName = byName;
    }
  }

  if (mapping.earnings === undefined) {
    const byMoney = findColumn((values) => values.some(looksLikeMoney));
    if (byMoney !== undefined) {
      mapping.earnings = byMoney;
    }
  }

  if (mapping.link === undefined) {
    const byLink = findColumn((values) => values.some(looksLikeLink));
    if (byLink !== undefined) {
      mapping.link = byLink;
    }
  }

  return mapping;
}

function buildHeaderMap(headerRow: string[], mapping: ColumnMapping): Record<string, string | null> {
  const headerMap: Record<string, string | null> = {};
  const keys: (keyof ColumnMapping)[] = [
    'phone',
    'fullName',
    'earnings',
    'link',
    'order',
    'address',
    'window',
    'payment',
    'comment'
  ];
  keys.forEach((key) => {
    const index = mapping[key];
    if (typeof index === 'number' && headerRow[index] !== undefined) {
      headerMap[key] = String(headerRow[index]).trim() || null;
    } else {
      headerMap[key] = null;
    }
  });
  return headerMap;
}

export async function parseXlsx(buffer: Buffer, adminId: number): Promise<CourierCard[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('В файле не найдено ни одного листа');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  if (!rows.length) {
    throw new Error('Файл пустой или не содержит данных');
  }
  const [headerRow, ...dataRows] = rows as string[][];
  const mapping = detectColumns(headerRow ?? [], dataRows ?? []);
  const now = dayjs().toISOString();
  const cards = dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const phoneRaw = mapping.phone !== undefined ? row[mapping.phone] : undefined;
      const earningsRaw = mapping.earnings !== undefined ? row[mapping.earnings] : undefined;
      const linkRaw = mapping.link !== undefined ? row[mapping.link] : undefined;
      const card: CourierCard = {
        id: uuid(),
        adminId,
        orderId: mapping.order !== undefined ? String(row[mapping.order] ?? '').trim() || undefined : undefined,
        customerName:
          mapping.fullName !== undefined && row[mapping.fullName] !== undefined
            ? normalizeFullName(String(row[mapping.fullName] ?? ''))
            : undefined,
        earningsLastWeek: normalizeMoney(earningsRaw),
        profileLink: normalizeLink(linkRaw),
        address: mapping.address !== undefined ? String(row[mapping.address] ?? '').trim() || undefined : undefined,
        window: mapping.window !== undefined ? String(row[mapping.window] ?? '').trim() || undefined : undefined,
        paymentType:
          mapping.payment !== undefined ? String(row[mapping.payment] ?? '').trim() || undefined : undefined,
        comment: mapping.comment !== undefined ? String(row[mapping.comment] ?? '').trim() || undefined : undefined,
        courierPhone: phoneRaw ? normalizePhone(String(phoneRaw)) ?? undefined : undefined,
        uploadedAt: now,
        status: 'pending'
      };
      return card;
    });

  await saveAdminTableMetadata(adminId, {
    uploadedAt: now,
    headers: buildHeaderMap(headerRow ?? [], mapping)
  });

  return cards;
}

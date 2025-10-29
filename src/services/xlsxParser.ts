import XLSX from 'xlsx';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';
import { CourierCard } from './types.js';
import { normalizeFullName } from '../utils/name.js';
import { normalizePhone } from '../utils/phone.js';

interface ColumnMapping {
  phone?: number;
  fullName?: number;
  order?: number;
  address?: number;
  window?: number;
  payment?: number;
  comment?: number;
}

const SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  phone: ['телефон', 'phone', 'номер', 'mobile'],
  fullName: ['фио', 'имя', 'courier', 'курьер'],
  order: ['заказ', 'order', '№', 'номер заказа'],
  address: ['адрес', 'address', 'куда', 'location'],
  window: ['окно', 'время', 'таймслот', 'slot'],
  payment: ['оплата', 'payment', 'тип оплаты'],
  comment: ['комментарий', 'примечание', 'коммент', 'comment']
};

function detectColumnIndex(headers: string[], synonyms: string[]): number | undefined {
  const normalized = headers.map((header) => header?.toLowerCase?.().trim?.() ?? '');
  for (const synonym of synonyms) {
    const idx = normalized.findIndex((header) => header.includes(synonym));
    if (idx >= 0) {
      return idx;
    }
  }
  return undefined;
}

function detectColumns(rows: string[][]): ColumnMapping {
  const [headerRow, ...rest] = rows;
  const mapping: ColumnMapping = {};
  if (!headerRow) return mapping;
  (Object.keys(SYNONYMS) as (keyof ColumnMapping)[]).forEach((key) => {
    const index = detectColumnIndex(headerRow, SYNONYMS[key]);
    if (typeof index === 'number') {
      mapping[key] = index;
    }
  });

  if (mapping.phone === undefined) {
    for (let col = 0; col < headerRow.length; col += 1) {
      const values = rest.map((row) => row[col] ?? '').join(' ');
      if (/\d{10,}/.test(values)) {
        mapping.phone = col;
        break;
      }
    }
  }

  if (mapping.fullName === undefined) {
    for (let col = 0; col < headerRow.length; col += 1) {
      const values = rest.map((row) => row[col] ?? '').join(' ');
      if (/\p{L}+\s+\p{L}+/u.test(values)) {
        mapping.fullName = col;
        break;
      }
    }
  }

  return mapping;
}

export function parseXlsx(buffer: Buffer, adminId: number): CourierCard[] {
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
  const mapping = detectColumns(rows as string[][]);
  const [, ...dataRows] = rows as string[][];
  const now = dayjs().toISOString();
  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const phoneRaw = mapping.phone !== undefined ? row[mapping.phone] : undefined;
      const card: CourierCard = {
        id: uuid(),
        adminId,
        orderId: mapping.order !== undefined ? String(row[mapping.order] ?? '').trim() : undefined,
        customerName: mapping.fullName !== undefined ? normalizeFullName(String(row[mapping.fullName] ?? '')) : undefined,
        address: mapping.address !== undefined ? String(row[mapping.address] ?? '').trim() : undefined,
        window: mapping.window !== undefined ? String(row[mapping.window] ?? '').trim() : undefined,
        paymentType: mapping.payment !== undefined ? String(row[mapping.payment] ?? '').trim() : undefined,
        comment: mapping.comment !== undefined ? String(row[mapping.comment] ?? '').trim() : undefined,
        courierPhone: phoneRaw ? normalizePhone(String(phoneRaw)) ?? undefined : undefined,
        uploadedAt: now,
        status: 'pending'
      };
      return card;
    });
}

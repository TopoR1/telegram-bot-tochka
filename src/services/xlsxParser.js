import XLSX from 'xlsx';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';
import { normalizeFullName } from '../utils/name.js';
import { normalizePhone } from '../utils/phone.js';
const SYNONYMS = {
    phone: ['телефон', 'phone', 'номер', 'mobile', /^contact$/],
    fullName: ['фио', 'имя', 'courier', 'курьер', 'contact_name', 'contact name'],
    earnings: ['заработок', 'выручка', 'доход', 'зарплата', 'income', 'прошлая неделя', 'price', 'payout'],
    link: ['ссылка', 'profile', 'профиль', 'link', 'url'],
    order: ['заказ', 'order', '№', 'номер заказа'],
    address: ['адрес', 'address', 'куда', 'location'],
    window: ['окно', 'время', 'таймслот', 'slot'],
    payment: ['оплата', 'payment', 'тип оплаты'],
    comment: ['комментарий', 'примечание', 'коммент', 'comment']
};
function looksLikePhone(value) {
    const digits = value.replace(/\D+/g, '');
    return digits.length >= 10;
}
function looksLikeFullName(value) {
    if (!value)
        return false;
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    if (/[0-9]/.test(trimmed))
        return false;
    if (/[.,;:!?@#№"'(){}\[\]<>]/.test(trimmed))
        return false;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 4)
        return false;
    return parts.every((part) => /^\p{L}+(?:-\p{L}+)*$/u.test(part));
}
function looksLikeMoney(value) {
    const cleaned = value.replace(/[\s\u00A0]/g, '');
    if (!/\d/.test(cleaned)) {
        return false;
    }
    return /(₽|руб|руб\.|rub|р\b)/i.test(value) || /\d{3}/.test(cleaned);
}
function looksLikeLink(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    if (/^https?:\/\//i.test(trimmed))
        return true;
    if (/^@/.test(trimmed))
        return true;
    return /(vk\.com|t\.me|telegram\.me|ok\.ru|instagram\.com|facebook\.com|^www\.|\.[a-z]{2,}$)/i.test(trimmed);
}
function looksLikeTochkaLink(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    if (!/tochka\.com/i.test(trimmed))
        return false;
    return looksLikeLink(trimmed);
}
function normalizeMoney(raw) {
    if (raw === undefined || raw === null)
        return undefined;
    const value = String(raw).replace(/[\s\u00A0]/g, '').trim();
    if (!value)
        return undefined;
    const digits = value.replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
    if (!digits)
        return undefined;
    const dotCount = (digits.match(/\./g) ?? []).length;
    let normalized = digits;
    if (dotCount > 1) {
        const lastDot = digits.lastIndexOf('.');
        const integer = digits.slice(0, lastDot).replace(/\./g, '');
        const fractional = digits.slice(lastDot + 1);
        normalized = fractional ? `${integer}.${fractional}` : integer;
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed))
        return undefined;
    return Number(parsed.toFixed(2));
}
function normalizeLink(raw) {
    if (raw === undefined || raw === null)
        return undefined;
    let value = String(raw).trim();
    if (!value)
        return undefined;
    value = value.replace(/[\s\u00A0]+/g, '');
    value = value.replace(/[.,;]+$/g, '');
    if (!value)
        return undefined;
    if (/^@/.test(value)) {
        return `https://t.me/${value.slice(1)}`;
    }
    if (/^https?:\/\//i.test(value)) {
        return /tochka\.com/i.test(value) ? value : undefined;
    }
    if (/^\/\//.test(value)) {
        const normalized = `https:${value}`;
        return /tochka\.com/i.test(normalized) ? normalized : undefined;
    }
    if (/[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
        const normalized = `https://${value}`;
        return /tochka\.com/i.test(normalized) ? normalized : undefined;
    }
    return /tochka\.com/i.test(value) ? value : undefined;
}
function detectColumns(headerRow, dataRows) {
    const mapping = {};
    const used = new Set();
    const normalizedHeaders = headerRow.map((header) => header?.toLowerCase?.().trim?.() ?? '');
    const matchesSynonym = (header, synonym) => {
        if (synonym instanceof RegExp) {
            return synonym.test(header);
        }
        return header.includes(synonym);
    };
    Object.keys(SYNONYMS).forEach((key) => {
        const synonyms = SYNONYMS[key];
        if (!synonyms?.length)
            return;
        const index = normalizedHeaders.findIndex((header, idx) => {
            if (used.has(idx))
                return false;
            return synonyms.some((synonym) => matchesSynonym(header, synonym));
        });
        if (index >= 0) {
            mapping[key] = index;
            used.add(index);
        }
    });
    const columnCount = headerRow.length;
    const getValues = (col) => dataRows
        .map((row) => (row[col] !== undefined && row[col] !== null ? String(row[col]) : ''))
        .filter((value) => value.trim() !== '');
    const findColumn = (predicate) => {
        for (let col = 0; col < columnCount; col += 1) {
            if (used.has(col))
                continue;
            const values = getValues(col);
            if (!values.length)
                continue;
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
        const byLink = findColumn((values) => values.some(looksLikeTochkaLink));
        if (byLink !== undefined) {
            mapping.link = byLink;
        }
    }
    return mapping;
}
function buildHeaderMap(headerRow, mapping) {
    const headerMap = {};
    const keys = [
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
        }
        else {
            headerMap[key] = null;
        }
    });
    return headerMap;
}
export async function parseXlsx(buffer, adminId) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('В файле не найдено ни одного листа');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (!rows.length) {
        throw new Error('Файл пустой или не содержит данных');
    }
    const [headerRow, ...dataRows] = rows;
    const mapping = detectColumns(headerRow ?? [], dataRows ?? []);
    const now = dayjs().toISOString();
    const cards = [];
    const rowsData = [];
    const isRowEmpty = (row) => !row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
    const readCell = (row, index) => {
        if (index === undefined)
            return undefined;
        const value = row[index];
        if (value === undefined || value === null)
            return undefined;
        const trimmed = String(value).trim();
        return trimmed || undefined;
    };
    for (const row of dataRows) {
        if (isRowEmpty(row)) {
            continue;
        }
        const rawPhone = readCell(row, mapping.phone);
        const normalizedPhone = rawPhone ? normalizePhone(rawPhone) ?? undefined : undefined;
        const earningsRaw = readCell(row, mapping.earnings);
        const linkRaw = readCell(row, mapping.link);
        const orderId = readCell(row, mapping.order);
        const address = readCell(row, mapping.address);
        const windowValue = readCell(row, mapping.window);
        const paymentType = readCell(row, mapping.payment);
        const comment = readCell(row, mapping.comment);
        const fullNameRaw = readCell(row, mapping.fullName);
        const customerName = fullNameRaw ? normalizeFullName(fullNameRaw) : undefined;
        const normalizedFullName = customerName ? customerName.replace(/\s+/g, ' ').toLowerCase() : undefined;
        const card = {
            id: uuid(),
            adminId,
            orderId,
            customerName,
            earningsLastWeek: normalizeMoney(earningsRaw),
            profileLink: normalizeLink(linkRaw),
            address,
            window: windowValue,
            paymentType,
            comment,
            courierPhone: normalizedPhone,
            courierFullName: customerName,
            uploadedAt: now,
            status: 'pending'
        };
        const normalizedRow = {
            id: card.id,
            orderId: card.orderId,
            customerName: card.customerName,
            normalizedFullName,
            phone: card.courierPhone,
            earningsLastWeek: card.earningsLastWeek,
            profileLink: card.profileLink,
            address: card.address,
            window: card.window,
            paymentType: card.paymentType,
            comment: card.comment
        };
        cards.push(card);
        rowsData.push(normalizedRow);
    }
    return {
        cards,
        headers: buildHeaderMap(headerRow ?? [], mapping),
        uploadedAt: now,
        rows: rowsData
    };
}

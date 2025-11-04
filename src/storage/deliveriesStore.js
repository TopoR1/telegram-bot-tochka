import { JsonStore } from './jsonStore.js';
const DELIVERIES_STORE_VERSION = 2;
const PER_COURIER_LIMIT = 50;
const DELIVERY_STATUS_VALUES = new Set(['pending', 'sent', 'skipped', 'error']);
const OPTIONAL_STRING_FIELDS = [
    'orderId',
    'customerName',
    'profileLink',
    'address',
    'window',
    'paymentType',
    'comment',
    'courierPhone',
    'courierFullName',
    'report'
];
const OPTIONAL_INTEGER_FIELDS = ['courierTelegramId', 'messageId', 'chatId'];
function cloneRecord(record) {
    return { ...record };
}
function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .filter(([, val]) => val !== undefined)
            .sort(([left], [right]) => {
            if (left < right)
                return -1;
            if (left > right)
                return 1;
            return 0;
        })
            .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
        return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value);
}
function isDeliveryRecord(value) {
    return Boolean(value) && typeof value === 'object';
}
function isDeliveriesState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    if (!Array.isArray(data.history) || typeof data.byCourier !== 'object' || !data.byCourier || Array.isArray(data.byCourier)) {
        return false;
    }
    const historyValid = data.history.every(isDeliveryRecord);
    const byCourierValid = Object.values(data.byCourier).every((items) => Array.isArray(items) && items.every(isDeliveryRecord));
    return historyValid && byCourierValid;
}
function isDeliveriesStoreData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    return data.version === DELIVERIES_STORE_VERSION && isDeliveriesState(data.items);
}
function sanitizeDeliveryRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
    }
    const sanitized = cloneRecord(record);
    if (typeof sanitized.id !== 'string' || sanitized.id.trim().length === 0) {
        return null;
    }
    sanitized.id = sanitized.id.trim();
    if (!Number.isInteger(sanitized.adminId)) {
        if (typeof sanitized.adminId === 'string') {
            const parsedAdminId = Number.parseInt(sanitized.adminId, 10);
            if (Number.isInteger(parsedAdminId)) {
                sanitized.adminId = parsedAdminId;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }
    if (typeof sanitized.uploadedAt !== 'string' || sanitized.uploadedAt.trim().length === 0) {
        if (typeof sanitized.sentAt === 'string' && sanitized.sentAt.trim().length > 0) {
            sanitized.uploadedAt = sanitized.sentAt.trim();
        }
        else {
            return null;
        }
    }
    else {
        sanitized.uploadedAt = sanitized.uploadedAt.trim();
    }
    if (sanitized.status !== undefined && !DELIVERY_STATUS_VALUES.has(sanitized.status)) {
        delete sanitized.status;
    }
    OPTIONAL_STRING_FIELDS.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(sanitized, field)) {
            return;
        }
        const value = sanitized[field];
        if (value === undefined || value === null) {
            delete sanitized[field];
            return;
        }
        const normalized = typeof value === 'string' ? value.trim() : String(value).trim();
        if (normalized) {
            sanitized[field] = normalized;
        }
        else {
            delete sanitized[field];
        }
    });
    if (sanitized.earningsLastWeek !== undefined) {
        if (typeof sanitized.earningsLastWeek === 'number' && Number.isFinite(sanitized.earningsLastWeek)) {
            sanitized.earningsLastWeek = Number(sanitized.earningsLastWeek.toFixed(2));
        }
        else {
            const parsed = Number.parseFloat(String(sanitized.earningsLastWeek));
            if (Number.isFinite(parsed)) {
                sanitized.earningsLastWeek = Number(parsed.toFixed(2));
            }
            else {
                delete sanitized.earningsLastWeek;
            }
        }
    }
    OPTIONAL_INTEGER_FIELDS.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(sanitized, field)) {
            return;
        }
        const value = sanitized[field];
        const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (Number.isInteger(parsed)) {
            sanitized[field] = parsed;
        }
        else {
            delete sanitized[field];
        }
    });
    if (sanitized.sentAt !== undefined && (typeof sanitized.sentAt !== 'string' || sanitized.sentAt.trim().length === 0)) {
        delete sanitized.sentAt;
    }
    return sanitized;
}
function sanitizeDeliveriesState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return { history: [], byCourier: {} };
    }
    const history = Array.isArray(state.history) ? state.history.map(sanitizeDeliveryRecord).filter(Boolean) : [];
    const byCourier = {};
    if (state.byCourier && typeof state.byCourier === 'object' && !Array.isArray(state.byCourier)) {
        for (const [key, items] of Object.entries(state.byCourier)) {
            if (!Array.isArray(items))
                continue;
            const sanitizedItems = items.map(sanitizeDeliveryRecord).filter(Boolean);
            if (sanitizedItems.length > 0) {
                byCourier[key] = sanitizedItems;
            }
        }
    }
    return { history, byCourier };
}
function cloneDeliveriesState(state) {
    const sanitized = sanitizeDeliveriesState(state);
    return {
        history: sanitized.history.map(cloneRecord),
        byCourier: Object.fromEntries(Object.entries(sanitized.byCourier).map(([key, items]) => [key, items.map(cloneRecord)]))
    };
}
function parseTimestamp(value) {
    if (!value) {
        return 0;
    }
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
function sortDeliveries(records) {
    return [...records].sort((a, b) => {
        const left = parseTimestamp(a.sentAt ?? a.uploadedAt);
        const right = parseTimestamp(b.sentAt ?? b.uploadedAt);
        return right - left;
    });
}
export const deliveriesStore = new JsonStore({
    name: 'deliveries',
    schemaKey: 'deliveries',
    defaultValue: () => ({ version: DELIVERIES_STORE_VERSION, items: { history: [], byCourier: {} } }),
    migrate: (raw) => {
        if (isDeliveriesStoreData(raw)) {
            const normalized = cloneDeliveriesState(raw.items);
            const migrated = stableStringify(raw.items ?? {}) !== stableStringify(normalized);
            return { data: { version: DELIVERIES_STORE_VERSION, items: normalized }, migrated };
        }
        if (isDeliveriesState(raw)) {
            return { data: { version: DELIVERIES_STORE_VERSION, items: cloneDeliveriesState(raw) }, migrated: true };
        }
        throw new Error('Unsupported deliveries store format');
    }
});
export async function recordDeliveries(records) {
    if (!records.length) {
        return;
    }
    const normalized = records.map(cloneRecord);
    await deliveriesStore.update((state) => {
        const nextHistory = [...state.items.history, ...normalized];
        const nextByCourier = { ...state.items.byCourier };
        for (const record of normalized) {
            const courierId = record.courierTelegramId;
            if (!courierId)
                continue;
            const key = courierId.toString();
            const existing = nextByCourier[key] ?? [];
            const filtered = existing.filter((item) => item.id !== record.id);
            const appended = sortDeliveries([...filtered, record]).slice(0, PER_COURIER_LIMIT);
            nextByCourier[key] = appended;
        }
        return {
            version: DELIVERIES_STORE_VERSION,
            items: cloneDeliveriesState({ history: nextHistory, byCourier: nextByCourier })
        };
    });
}
export async function getCourierDeliveries(telegramId) {
    const state = await deliveriesStore.read();
    const records = state.items.byCourier[telegramId.toString()] ?? [];
    return sortDeliveries(records);
}
export async function getDeliveryHistory() {
    const state = await deliveriesStore.read();
    return sortDeliveries(state.items.history);
}

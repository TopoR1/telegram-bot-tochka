import dayjs from 'dayjs';
import { JsonStore } from './jsonStore.js';
const USERS_STORE_VERSION = 2;
function isUserRecord(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const record = value;
    return typeof record.telegramId === 'number' && typeof record.createdAt === 'string' && typeof record.updatedAt === 'string';
}
function isLegacyUsersCollection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every(isUserRecord);
}
function isUsersStoreData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    return data.version === USERS_STORE_VERSION && Array.isArray(data.users) && data.users.every(isUserRecord);
}
function cloneUser(record) {
    return { ...record };
}
function mapFromUsers(users) {
    const map = new Map();
    for (const user of users) {
        map.set(user.telegramId, user);
    }
    return map;
}
function mapToUsers(map) {
    return Array.from(map.values()).map(cloneUser);
}
export const usersStore = new JsonStore({
    name: 'users',
    schemaKey: 'users',
    defaultValue: () => ({ version: USERS_STORE_VERSION, users: [] }),
    migrate: (raw) => {
        if (isUsersStoreData(raw)) {
            return { data: { version: USERS_STORE_VERSION, users: raw.users.map(cloneUser) }, migrated: false };
        }
        if (isLegacyUsersCollection(raw)) {
            const users = Object.values(raw).map(cloneUser);
            return { data: { version: USERS_STORE_VERSION, users }, migrated: true };
        }
        throw new Error('Unsupported users store format');
    }
});
export async function upsertUser(payload) {
    const now = dayjs().toISOString();
    let record;
    await usersStore.update((state) => {
        const index = mapFromUsers(state.users);
        const existing = index.get(payload.telegramId);
        const base = existing
            ? { ...existing }
            : {
                telegramId: payload.telegramId,
                createdAt: now,
                updatedAt: now
            };
        if (payload.username !== undefined) {
            base.username = payload.username;
        }
        if (payload.firstName !== undefined) {
            base.firstName = payload.firstName;
        }
        if (payload.lastName !== undefined) {
            base.lastName = payload.lastName;
        }
        if (payload.phone !== undefined) {
            if (payload.phone === null) {
                delete base.phone;
            }
            else {
                base.phone = payload.phone;
            }
        }
        if (payload.normalizedPhone !== undefined) {
            if (payload.normalizedPhone === null) {
                delete base.normalizedPhone;
            }
            else {
                base.normalizedPhone = payload.normalizedPhone;
            }
        }
        if (payload.phoneValidated !== undefined) {
            base.phoneValidated = payload.phoneValidated;
        }
        base.updatedAt = now;
        record = base;
        index.set(payload.telegramId, base);
        return {
            version: USERS_STORE_VERSION,
            users: mapToUsers(index)
        };
    });
    return record;
}
export async function markTaskRequest(telegramId) {
    const now = dayjs().toISOString();
    let record;
    await usersStore.update((state) => {
        const index = mapFromUsers(state.users);
        const existing = index.get(telegramId);
        if (!existing) {
            return state;
        }
        record = {
            ...existing,
            lastTaskRequestAt: now,
            updatedAt: now
        };
        index.set(telegramId, record);
        return {
            version: USERS_STORE_VERSION,
            users: mapToUsers(index)
        };
    });
    return record;
}
export async function getUser(telegramId) {
    const state = await usersStore.read();
    const found = state.users.find((user) => user.telegramId === telegramId);
    return found ? { ...found } : undefined;
}

import dayjs from 'dayjs';
import { JsonStore } from './jsonStore.js';

export interface UserRecord {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  normalizedPhone?: string;
  phoneValidated?: boolean;
  createdAt: string;
  updatedAt: string;
  lastTaskRequestAt?: string;
}

const USERS_STORE_VERSION = 1;

export interface UsersStoreData {
  version: number;
  users: UserRecord[];
}

function isUserRecord(value: unknown): value is UserRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.telegramId === 'number' && typeof record.createdAt === 'string' && typeof record.updatedAt === 'string';
}

function isLegacyUsersCollection(value: unknown): value is Record<string, UserRecord> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isUserRecord);
}

function isUsersStoreData(value: unknown): value is UsersStoreData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return data.version === USERS_STORE_VERSION && Array.isArray(data.users) && data.users.every(isUserRecord);
}

function cloneUser(record: UserRecord): UserRecord {
  return { ...record };
}

function mapFromUsers(users: UserRecord[]): Map<number, UserRecord> {
  const map = new Map<number, UserRecord>();
  for (const user of users) {
    map.set(user.telegramId, user);
  }
  return map;
}

function mapToUsers(map: Map<number, UserRecord>): UserRecord[] {
  return Array.from(map.values()).map(cloneUser);
}

export const usersStore = new JsonStore<UsersStoreData>({
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

export interface UserUpsertPayload {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  normalizedPhone?: string | null;
  phoneValidated?: boolean;
}

export async function upsertUser(payload: UserUpsertPayload): Promise<UserRecord> {
  const now = dayjs().toISOString();
  let record!: UserRecord;
  await usersStore.update((state) => {
    const index = mapFromUsers(state.users);
    const existing = index.get(payload.telegramId);
    const base: UserRecord = existing
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
      } else {
        base.phone = payload.phone;
      }
    }

    if (payload.normalizedPhone !== undefined) {
      if (payload.normalizedPhone === null) {
        delete base.normalizedPhone;
      } else {
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

export async function markTaskRequest(telegramId: number): Promise<UserRecord | undefined> {
  const now = dayjs().toISOString();
  let record: UserRecord | undefined;
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

export async function getUser(telegramId: number): Promise<UserRecord | undefined> {
  const state = await usersStore.read();
  const found = state.users.find((user) => user.telegramId === telegramId);
  return found ? { ...found } : undefined;
}

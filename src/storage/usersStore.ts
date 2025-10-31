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

export type UsersCollection = Record<string, UserRecord>;

export const usersStore = new JsonStore<UsersCollection>({
  name: 'users',
  schemaKey: 'users',
  defaultValue: () => ({})
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
  await usersStore.update((collection) => {
    const key = payload.telegramId.toString();
    const existing = collection[key];
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
    collection[key] = base;
    return collection;
  });
  return record;
}

export async function markTaskRequest(telegramId: number): Promise<UserRecord | undefined> {
  const now = dayjs().toISOString();
  let record: UserRecord | undefined;
  await usersStore.update((collection) => {
    const key = telegramId.toString();
    const existing = collection[key];
    if (!existing) {
      return collection;
    }
    record = {
      ...existing,
      lastTaskRequestAt: now,
      updatedAt: now
    };
    collection[key] = record;
    return collection;
  });
  return record;
}

export async function getUser(telegramId: number): Promise<UserRecord | undefined> {
  const collection = await usersStore.read();
  return collection[telegramId.toString()];
}

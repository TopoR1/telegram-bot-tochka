import dayjs from 'dayjs';
import { adminStore } from '../storage/index.js';
import { getGroupBindings } from '../storage/groupBindingsStore.js';
import { AdminProfile, AdminRecord } from './types.js';

export async function getOrCreateAdmin(
  telegramId: number,
  profile: Partial<AdminRecord>
): Promise<AdminProfile> {
  const now = dayjs().toISOString();
  let record!: AdminRecord;
  await adminStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (existing) {
      record = {
        ...existing,
        ...profile,
        updatedAt: now
      };
      collection[telegramId.toString()] = record;
      return collection;
    }
    record = {
      telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      createdAt: now,
      updatedAt: now,
      lastUploadAt: profile.lastUploadAt
    };
    collection[telegramId.toString()] = record;
    return collection;
  });
  const bindings = await getGroupBindings(telegramId);
  return { ...record, groupBindings: bindings };
}

export async function updateAdmin(
  telegramId: number,
  updater: (admin: AdminRecord) => AdminRecord
): Promise<AdminProfile> {
  let updated!: AdminRecord;
  await adminStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (!existing) {
      throw new Error('Admin not found');
    }
    updated = {
      ...updater(existing),
      updatedAt: dayjs().toISOString()
    };
    collection[telegramId.toString()] = updated;
    return collection;
  });
  const bindings = await getGroupBindings(telegramId);
  return { ...updated, groupBindings: bindings };
}

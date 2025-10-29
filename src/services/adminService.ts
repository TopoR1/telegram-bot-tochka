import dayjs from 'dayjs';
import { adminStore } from '../storage/index.js';
import { AdminRecord, GroupBinding } from './types.js';

export async function getOrCreateAdmin(telegramId: number, profile: Partial<AdminRecord>): Promise<AdminRecord> {
  const now = dayjs().toISOString();
  return adminStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (existing) {
      const updated: AdminRecord = {
        ...existing,
        ...profile,
        updatedAt: now
      };
      collection[telegramId.toString()] = updated;
      return collection;
    }
    const created: AdminRecord = {
      telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      createdAt: now,
      updatedAt: now,
      groupBindings: profile.groupBindings ?? []
    };
    collection[telegramId.toString()] = created;
    return collection;
  }).then((collection) => collection[telegramId.toString()]);
}

export async function updateAdmin(telegramId: number, updater: (admin: AdminRecord) => AdminRecord): Promise<AdminRecord> {
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
  return updated;
}

export async function listGroupBindings(telegramId: number): Promise<GroupBinding[]> {
  const collection = await adminStore.read();
  return collection[telegramId.toString()]?.groupBindings ?? [];
}

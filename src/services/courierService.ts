import dayjs from 'dayjs';
import { courierStore } from '../storage/index.js';
import { CourierRecord } from './types.js';

export async function getOrCreateCourier(telegramId: number, profile: Partial<CourierRecord>): Promise<CourierRecord> {
  const now = dayjs().toISOString();
  return courierStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (existing) {
      const updated: CourierRecord = {
        ...existing,
        ...profile,
        updatedAt: now
      };
      collection[telegramId.toString()] = updated;
      return collection;
    }
    const created: CourierRecord = {
      telegramId,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName,
      phone: profile.phone,
      createdAt: now,
      updatedAt: now,
      adminIds: profile.adminIds ?? [],
      lastCards: {},
      awaitingFullName: profile.awaitingFullName,
      announcementTargets: profile.announcementTargets ?? []
    };
    collection[telegramId.toString()] = created;
    return collection;
  }).then((collection) => collection[telegramId.toString()]);
}

export async function updateCourier(telegramId: number, updater: (courier: CourierRecord) => CourierRecord): Promise<CourierRecord> {
  let updated!: CourierRecord;
  await courierStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (!existing) {
      throw new Error('Courier not found');
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

export async function listCourierCards(telegramId: number): Promise<CourierRecord | undefined> {
  const collection = await courierStore.read();
  return collection[telegramId.toString()];
}

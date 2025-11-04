import dayjs from 'dayjs';
import { courierStore } from '../storage/index.js';

/**
 * @typedef {import('./types.js').CourierRecord} CourierRecord
 */

function normalizePartialProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {};
  }
  return profile;
}

function sanitizeProfile(profile) {
  const sanitized = {};
  for (const [key, value] of Object.entries(profile)) {
    if (value === undefined) {
      continue;
    }
    if (key === 'awaitingFullName') {
      sanitized.awaitingFullName = Boolean(value);
      continue;
    }
    if (key === 'adminIds') {
      if (Array.isArray(value)) {
        sanitized.adminIds = value.map((id) => id);
      }
      continue;
    }
    if (key === 'announcementTargets') {
      if (Array.isArray(value)) {
        sanitized.announcementTargets = value.map((target) => ({ ...target }));
      }
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

/**
 * @param {number} telegramId
 * @param {object} profile
 * @returns {Promise<CourierRecord>}
 */
export async function getOrCreateCourier(telegramId, profile) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  const safeProfile = normalizePartialProfile(profile);
  const sanitizedProfile = sanitizeProfile(safeProfile);
  const now = dayjs().toISOString();
  return courierStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (existing) {
      const adminIds = sanitizedProfile.adminIds
        ? [...sanitizedProfile.adminIds]
        : existing.adminIds;
      const announcementTargets = sanitizedProfile.announcementTargets
        ? sanitizedProfile.announcementTargets.map((target) => ({ ...target }))
        : existing.announcementTargets;
      const updated = {
        ...existing,
        ...sanitizedProfile,
        adminIds,
        announcementTargets,
        updatedAt: now
      };
      collection[telegramId.toString()] = updated;
      return collection;
    }
    const created = {
        telegramId,
        username: sanitizedProfile.username,
        firstName: sanitizedProfile.firstName,
        lastName: sanitizedProfile.lastName,
        fullName: sanitizedProfile.fullName,
        phone: sanitizedProfile.phone,
        createdAt: now,
        updatedAt: now,
        adminIds: Array.isArray(sanitizedProfile.adminIds)
          ? [...sanitizedProfile.adminIds]
          : [],
        lastCards: {},
        awaitingFullName: sanitizedProfile.awaitingFullName ?? false,
        announcementTargets: Array.isArray(sanitizedProfile.announcementTargets)
          ? sanitizedProfile.announcementTargets.map((target) => ({ ...target }))
          : []
    };
    collection[telegramId.toString()] = created;
    return collection;
  }).then((collection) => collection[telegramId.toString()]);
}
/**
 * @param {number} telegramId
 * @param {(courier: CourierRecord) => CourierRecord} updater
 * @returns {Promise<CourierRecord>}
 */
export async function updateCourier(telegramId, updater) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  if (typeof updater !== 'function') {
    throw new TypeError('updater must be a function');
  }
  let updated;
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

/**
 * Возвращает данные курьера без создания новой записи.
 *
 * @param {number} telegramId
 * @returns {Promise<CourierRecord | undefined>}
 */
export async function getCourier(telegramId) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  const collection = await courierStore.read();
  const record = collection[telegramId.toString()];
  return record ? { ...record } : undefined;
}
/**
 * @param {number} telegramId
 * @returns {Promise<CourierRecord | undefined>}
 */
export async function listCourierCards(telegramId) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  const collection = await courierStore.read();
  return collection[telegramId.toString()];
}

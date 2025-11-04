import dayjs from 'dayjs';
import { adminStore } from '../storage/index.js';
import { getGroupBindings } from '../storage/groupBindingsStore.js';

/**
 * @typedef {import('./types.js').AdminRecord} AdminRecord
 * @typedef {import('./types.js').AdminProfile} AdminProfile
 */

function normalizeAdminProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return {};
  }
  return profile;
}

/**
 * @param {number} telegramId
 * @param {object} profile
 * @returns {Promise<AdminProfile>}
 */
export async function getOrCreateAdmin(telegramId, profile) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  const safeProfile = normalizeAdminProfile(profile);
  const now = dayjs().toISOString();
  let record;
  await adminStore.update((collection) => {
    const existing = collection[telegramId.toString()];
    if (existing) {
      record = {
        ...existing,
        ...safeProfile,
        updatedAt: now
      };
      collection[telegramId.toString()] = record;
      return collection;
    }
    record = {
      telegramId,
      username: safeProfile.username,
      firstName: safeProfile.firstName,
      lastName: safeProfile.lastName,
      createdAt: now,
      updatedAt: now,
      lastUploadAt: safeProfile.lastUploadAt
    };
    collection[telegramId.toString()] = record;
    return collection;
  });
  const bindings = await getGroupBindings(telegramId);
  return { ...record, groupBindings: bindings };
}

/**
 * @param {number} telegramId
 * @param {(admin: AdminRecord) => AdminRecord} updater
 * @returns {Promise<AdminProfile>}
 */
export async function updateAdmin(telegramId, updater) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  if (typeof updater !== 'function') {
    throw new TypeError('updater must be a function');
  }
  let updated;
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

/**
 * Проверяет, зарегистрирован ли пользователь как администратор.
 *
 * @param {number} telegramId
 * @returns {Promise<boolean>}
 */
export async function isAdmin(telegramId) {
  if (!Number.isInteger(telegramId)) {
    throw new TypeError('telegramId must be an integer');
  }
  const collection = await adminStore.read();
  return Boolean(collection[telegramId.toString()]);
}

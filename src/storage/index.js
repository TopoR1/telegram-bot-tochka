import { JsonStore } from './jsonStore.js';

/**
 * @typedef {import('../services/types.js').CourierRecord} CourierRecord
 * @typedef {import('../services/types.js').AdminRecord} AdminRecord
 * @typedef {import('../services/types.js').AnnouncementPayload} AnnouncementPayload
 */

/** @type {JsonStore<Record<string, CourierRecord>>} */
export const courierStore = new JsonStore({
  name: 'couriers',
  schemaKey: 'couriers',
  defaultValue: () => ({})
});

/** @type {JsonStore<Record<string, AdminRecord>>} */
export const adminStore = new JsonStore({
  name: 'admins',
  schemaKey: 'admins',
  defaultValue: () => ({})
});

/** @type {JsonStore<AnnouncementPayload[]>} */
export const announcementStore = new JsonStore({
  name: 'announcements',
  schemaKey: 'announcements',
  defaultValue: () => []
});

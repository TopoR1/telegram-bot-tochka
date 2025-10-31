import { JsonStore } from './jsonStore.js';
import { AdminRecord, CourierRecord, AnnouncementPayload } from '../services/types.js';

export type CourierCollection = Record<string, CourierRecord>;
export type AdminCollection = Record<string, AdminRecord>;
export type AnnouncementCollection = AnnouncementPayload[];

export const courierStore = new JsonStore<CourierCollection>({
  name: 'couriers',
  schemaKey: 'couriers',
  defaultValue: () => ({})
});

export const adminStore = new JsonStore<AdminCollection>({
  name: 'admins',
  schemaKey: 'admins',
  defaultValue: () => ({})
});

export const announcementStore = new JsonStore<AnnouncementCollection>({
  name: 'announcements',
  schemaKey: 'announcements',
  defaultValue: () => []
});

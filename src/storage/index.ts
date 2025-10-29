import { JsonStore } from './jsonStore.js';
import { AdminRecord, CourierRecord, DeliveryRecord, AnnouncementPayload } from '../services/types.js';

export type CourierCollection = Record<string, CourierRecord>;
export type AdminCollection = Record<string, AdminRecord>;
export type DeliveryCollection = DeliveryRecord[];
export type AnnouncementCollection = AnnouncementPayload[];

const courierSchema = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      telegramId: { type: 'number' },
      username: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      fullName: { type: 'string' },
      phone: { type: 'string' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      awaitingFullName: { type: 'boolean' },
      adminIds: {
        type: 'array',
        items: { type: 'number' }
      },
      lastCards: {
        type: 'object',
        additionalProperties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              adminId: { type: 'number' },
              orderId: { type: 'string' },
              customerName: { type: 'string' },
              address: { type: 'string' },
              window: { type: 'string' },
              paymentType: { type: 'string' },
              comment: { type: 'string' },
              courierPhone: { type: 'string' },
              courierFullName: { type: 'string' },
              courierTelegramId: { type: 'number' },
              status: { enum: ['pending', 'sent', 'failed'] },
              uploadedAt: { type: 'string' },
              sentAt: { type: 'string' },
              messageId: { type: 'number' },
              chatId: { type: 'number' }
            },
            required: ['id', 'adminId', 'uploadedAt'],
            additionalProperties: false
          }
        }
      },
      announcementTargets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chatId: { type: 'number' },
            title: { type: 'string' },
            threadId: { type: 'number' }
          },
          required: ['chatId', 'title'],
          additionalProperties: false
        }
      }
    },
    required: ['telegramId', 'createdAt', 'updatedAt', 'adminIds', 'lastCards'],
    additionalProperties: false
  }
};

const adminSchema = {
  type: 'object',
  additionalProperties: {
    type: 'object',
    properties: {
      telegramId: { type: 'number' },
      username: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      lastUploadAt: { type: 'string' },
      groupBindings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chatId: { type: 'number' },
            title: { type: 'string' },
            threadId: { type: 'number' }
          },
          required: ['chatId', 'title'],
          additionalProperties: false
        }
      }
    },
    required: ['telegramId', 'createdAt', 'updatedAt', 'groupBindings'],
    additionalProperties: false
  }
};

const deliverySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      adminId: { type: 'number' },
      orderId: { type: 'string' },
      customerName: { type: 'string' },
      address: { type: 'string' },
      window: { type: 'string' },
      paymentType: { type: 'string' },
      comment: { type: 'string' },
      courierPhone: { type: 'string' },
      courierFullName: { type: 'string' },
      courierTelegramId: { type: 'number' },
      status: { enum: ['pending', 'sent', 'failed'] },
      uploadedAt: { type: 'string' },
      sentAt: { type: 'string' },
      messageId: { type: 'number' },
      chatId: { type: 'number' },
      report: { type: 'string' }
    },
    required: ['id', 'adminId', 'uploadedAt'],
    additionalProperties: false
  }
};

const announcementsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      adminId: { type: 'number' },
      target: {
        type: 'object',
        properties: {
          chatId: { type: 'number' },
          title: { type: 'string' },
          threadId: { type: 'number' }
        },
        required: ['chatId', 'title'],
        additionalProperties: false
      },
      message: { type: 'string' },
      sentAt: { type: 'string' }
    },
    required: ['adminId', 'target', 'message', 'sentAt'],
    additionalProperties: false
  }
};

export const courierStore = new JsonStore<CourierCollection>({
  name: 'couriers',
  schema: courierSchema,
  defaultValue: () => ({})
});

export const adminStore = new JsonStore<AdminCollection>({
  name: 'admins',
  schema: adminSchema,
  defaultValue: () => ({})
});

export const deliveryStore = new JsonStore<DeliveryCollection>({
  name: 'deliveries',
  schema: deliverySchema,
  defaultValue: () => []
});

export const announcementStore = new JsonStore<AnnouncementCollection>({
  name: 'announcements',
  schema: announcementsSchema,
  defaultValue: () => []
});

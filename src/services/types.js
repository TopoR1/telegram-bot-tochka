/**
 * @typedef {Object} GroupBinding
 * @property {number} chatId Telegram chat identifier of the bound group
 * @property {string} title Human readable group title
 * @property {number} [messageThreadId] Optional topic/thread identifier inside the group
 */

/**
 * @typedef {Object} CourierCard
 * @property {string} id Stable identifier of the card row
 * @property {number} adminId Administrator that uploaded the card
 * @property {string} [orderId]
 * @property {string} [customerName]
 * @property {number} [earningsLastWeek]
 * @property {string} [profileLink]
 * @property {string} [address]
 * @property {string} [window]
 * @property {string} [paymentType]
 * @property {string} [comment]
 * @property {string} [courierPhone]
 * @property {string} [courierFullName]
 * @property {number} [courierTelegramId]
 * @property {DeliveryStatus} [status]
 * @property {string} uploadedAt ISO8601 upload timestamp
 * @property {string} [sentAt] ISO8601 timestamp of dispatch to Telegram
 * @property {number} [messageId] Telegram message id of the sent card
 * @property {number} [chatId] Telegram chat id where the card was sent
 * @property {string} [report] Courier delivery report
 */

/**
 * @typedef {CourierCard} DeliveryRecord
 */

/**
 * @typedef {Object} CourierRecord
 * @property {number} telegramId Courier Telegram id
 * @property {string} [username]
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [fullName]
 * @property {string} [phone]
 * @property {string} createdAt ISO8601 timestamp of creation
 * @property {string} updatedAt ISO8601 timestamp of last update
 * @property {boolean} [awaitingFullName]
 * @property {number[]} adminIds Ids of administrators that interacted with the courier
 * @property {Record<string, CourierCard[]>} lastCards Last cards sent to the courier (keyed by admin id)
 * @property {GroupBinding[]} [announcementTargets]
 */

/**
 * @typedef {Object} AdminRecord
 * @property {number} telegramId
 * @property {string} [username]
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} [lastUploadAt]
 */

/**
 * @typedef {AdminRecord & {
 *   groupBindings: GroupBinding[];
 * }} AdminProfile
 */

/**
 * @typedef {'pending' | 'sent' | 'skipped' | 'error'} DeliveryStatus
 */

/**
 * @typedef {Object} AnnouncementPayload
 * @property {number} adminId
 * @property {GroupBinding} target
 * @property {string} message
 * @property {string} sentAt
 */

export const DeliveryStatus = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  SKIPPED: 'skipped',
  ERROR: 'error'
});

export const DELIVERY_STATUS_VALUES = Object.freeze(Object.values(DeliveryStatus));

/**
 * @param {unknown} value
 * @returns {value is GroupBinding}
 */
export function isGroupBinding(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value.chatId === 'number' &&
      Number.isFinite(value.chatId) &&
      typeof value.title === 'string' &&
      value.title.trim().length > 0 &&
      (value.messageThreadId === undefined || Number.isInteger(value.messageThreadId))
  );
}

/**
 * @param {unknown} value
 * @returns {value is CourierCard}
 */
export function isCourierCard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return false;
  }
  if (!Number.isInteger(record.adminId)) {
    return false;
  }
  if (typeof record.uploadedAt !== 'string' || record.uploadedAt.length === 0) {
    return false;
  }
  if (record.status && !DELIVERY_STATUS_VALUES.includes(record.status)) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} value
 * @returns {value is CourierRecord}
 */
export function isCourierRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value;
  if (!Number.isInteger(record.telegramId)) {
    return false;
  }
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') {
    return false;
  }
  if (!Array.isArray(record.adminIds) || !record.adminIds.every((id) => Number.isInteger(id))) {
    return false;
  }
  if (typeof record.lastCards !== 'object' || record.lastCards === null || Array.isArray(record.lastCards)) {
    return false;
  }
  for (const cards of Object.values(record.lastCards)) {
    if (!Array.isArray(cards) || !cards.every((card) => isCourierCard(card))) {
      return false;
    }
  }
  if (
    record.announcementTargets &&
    (!Array.isArray(record.announcementTargets) || !record.announcementTargets.every((target) => isGroupBinding(target)))
  ) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} value
 * @returns {value is AdminRecord}
 */
export function isAdminRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value;
  return (
    Number.isInteger(record.telegramId) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

/**
 * @param {unknown} value
 * @returns {value is AnnouncementPayload}
 */
export function isAnnouncementPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value;
  return (
    Number.isInteger(record.adminId) &&
    typeof record.message === 'string' &&
    record.message.length > 0 &&
    typeof record.sentAt === 'string' &&
    isGroupBinding(record.target)
  );
}

export default {
  DeliveryStatus,
  DELIVERY_STATUS_VALUES,
  isGroupBinding,
  isCourierCard,
  isCourierRecord,
  isAdminRecord,
  isAnnouncementPayload
};

/**
 * @typedef {import('telegraf').Context<import('telegraf/typings/core/types/typegram').Update>} BaseContext
 * @typedef {import('../services/types.js').CourierRecord} CourierRecord
 * @typedef {import('../services/types.js').AdminProfile} AdminProfile
 * @typedef {import('../services/types.js').GroupBinding} GroupBinding
 */

/**
 * @typedef {Object} PendingGroupBinding
 * @property {number} chatId
 * @property {string} title
 * @property {number} [forwardedThreadId]
 */

/**
 * @typedef {Object} SessionState
 * @property {boolean} [awaitingFullName]
 * @property {boolean} [awaitingAnnouncement]
 * @property {GroupBinding} [selectedGroup]
 * @property {string} [pendingAnnouncementText]
 * @property {boolean} [awaitingTopicSelection]
 * @property {PendingGroupBinding} [pendingGroupBinding]
 */

/**
 * Custom context used across bot handlers.
 *
 * @typedef {BaseContext & {
 *   courierProfile?: CourierRecord;
 *   adminProfile?: AdminProfile;
 *   sessionState?: SessionState;
 * }} BotContext
 */

/**
 * Creates an empty session state object.
 *
 * @returns {SessionState}
 */
export function createEmptySessionState() {
  return {};
}

export default {
  createEmptySessionState
};

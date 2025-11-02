/**
 * @typedef {import('./types.js').BotContext} BotContext
 * @typedef {import('./types.js').SessionState} SessionState
 */

class SessionManager {
  constructor() {
    this.store = new Map();
  }

  /**
   * @param {number} userId
   * @returns {SessionState}
   */
  get(userId) {
    if (!this.store.has(userId)) {
      this.store.set(userId, {});
    }
    return this.store.get(userId);
  }

  /**
   * @param {number} userId
   * @param {SessionState} state
   */
  set(userId, state) {
    this.store.set(userId, state);
  }

  /**
   * @param {number} userId
   */
  reset(userId) {
    this.store.delete(userId);
  }
}

export const sessionManager = new SessionManager();

/**
 * @param {BotContext} ctx
 */
export function attachSession(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;
  ctx.sessionState = sessionManager.get(userId);
}

/**
 * @param {BotContext} ctx
 */
export function persistSession(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return;
  sessionManager.set(userId, ctx.sessionState ?? {});
}

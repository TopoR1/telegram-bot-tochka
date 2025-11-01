import { BotContext } from './types.js';

interface SessionState {
  awaitingFullName?: boolean;
  awaitingAnnouncement?: boolean;
  selectedGroup?: {
    chatId: number;
    title: string;
    messageThreadId?: number;
  };
  pendingAnnouncementText?: string;
  awaitingTopicSelection?: boolean;
  pendingGroupBinding?: {
    chatId: number;
    title: string;
    forwardedThreadId?: number;
  };
}

class SessionManager {
  private store = new Map<number, SessionState>();

  get(userId: number): SessionState {
    if (!this.store.has(userId)) {
      this.store.set(userId, {});
    }
    return this.store.get(userId)!;
  }

  set(userId: number, state: SessionState): void {
    this.store.set(userId, state);
  }

  reset(userId: number): void {
    this.store.delete(userId);
  }
}

export const sessionManager = new SessionManager();

export function attachSession(ctx: BotContext): void {
  const userId = ctx.from?.id;
  if (!userId) return;
  ctx.sessionState = sessionManager.get(userId);
}

export function persistSession(ctx: BotContext): void {
  const userId = ctx.from?.id;
  if (!userId) return;
  sessionManager.set(userId, ctx.sessionState ?? {});
}

import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { CourierRecord, AdminProfile, GroupBinding } from '../services/types.js';

export interface BotContext extends Context<Update> {
  courierProfile?: CourierRecord;
  adminProfile?: AdminProfile;
  sessionState?: {
    awaitingFullName?: boolean;
    awaitingAnnouncement?: boolean;
    selectedGroup?: GroupBinding;
    pendingAnnouncementText?: string;
    awaitingTopicSelection?: boolean;
    pendingGroupBinding?: {
      chatId: number;
      title: string;
      forwardedThreadId?: number;
    };
  };
}

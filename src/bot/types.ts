import { Context } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { CourierRecord, AdminRecord, GroupBinding } from '../services/types.js';

export interface BotContext extends Context<Update> {
  courierProfile?: CourierRecord;
  adminProfile?: AdminRecord;
  sessionState?: {
    awaitingFullName?: boolean;
    awaitingAnnouncement?: boolean;
    selectedGroup?: GroupBinding;
    pendingAnnouncementText?: string;
  };
}

export interface CourierRecord {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  awaitingFullName?: boolean;
  adminIds: number[];
  lastCards: Record<string, CourierCard[]>;
  announcementTargets?: GroupBinding[];
}

export interface GroupBinding {
  chatId: number;
  title: string;
  threadId?: number;
}

export interface AdminRecord {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
  lastUploadAt?: string;
}

export interface AdminProfile extends AdminRecord {
  groupBindings: GroupBinding[];
}

export type DeliveryStatus = 'pending' | 'sent' | 'skipped' | 'error';

export interface CourierCard {
  id: string;
  adminId: number;
  orderId?: string;
  customerName?: string;
  earningsLastWeek?: number;
  profileLink?: string;
  address?: string;
  window?: string;
  paymentType?: string;
  comment?: string;
  courierPhone?: string;
  courierFullName?: string;
  courierTelegramId?: number;
  status?: DeliveryStatus;
  uploadedAt: string;
  sentAt?: string;
  messageId?: number;
  chatId?: number;
  report?: string;
}

export interface DeliveryRecord extends CourierCard {}

export interface AnnouncementPayload {
  adminId: number;
  target: GroupBinding;
  message: string;
  sentAt: string;
}

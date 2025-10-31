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
  status?: 'pending' | 'sent' | 'failed';
  uploadedAt: string;
  sentAt?: string;
  messageId?: number;
  chatId?: number;
}

export interface DeliveryRecord extends CourierCard {
  report?: string;
}

export interface DeliveryReport {
  adminId: number;
  total: number;
  success: number;
  failed: number;
  missingCouriers: string[];
  cards: CourierCard[];
}

export interface AnnouncementPayload {
  adminId: number;
  target: GroupBinding;
  message: string;
  sentAt: string;
}

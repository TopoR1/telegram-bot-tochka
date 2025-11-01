import { JsonStore } from './jsonStore.js';

export interface AdminTableRow {
  id: string;
  orderId?: string;
  customerName?: string;
  normalizedFullName?: string;
  phone?: string;
  earningsLastWeek?: number;
  profileLink?: string;
  address?: string;
  window?: string;
  paymentType?: string;
  comment?: string;
}

export interface AdminTableMetadata {
  uploadedAt: string;
  headers: Record<string, string | null>;
  rows: AdminTableRow[];
}

export type AdminTablesCollection = Record<string, AdminTableMetadata>;

export const adminTablesStore = new JsonStore<AdminTablesCollection>({
  name: 'admin_tables',
  schemaKey: 'adminTables',
  defaultValue: () => ({})
});

export async function saveAdminTableMetadata(
  adminId: number,
  metadata: AdminTableMetadata
): Promise<void> {
  await adminTablesStore.update((collection) => {
    collection[adminId.toString()] = metadata;
    return collection;
  });
}

export async function getAdminTableMetadata(
  adminId: number
): Promise<AdminTableMetadata | undefined> {
  const collection = await adminTablesStore.read();
  return collection[adminId.toString()];
}

export async function listAdminTables(): Promise<AdminTablesCollection> {
  return adminTablesStore.read();
}

import { JsonStore } from './jsonStore.js';

export interface AdminTableMetadata {
  uploadedAt: string;
  headers: Record<string, string | null>;
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

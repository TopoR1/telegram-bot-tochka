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

const ADMIN_TABLES_VERSION = 1;

export interface AdminTablesStoreData {
  version: number;
  tables: AdminTablesCollection;
}

function isAdminTableMetadata(value: unknown): value is AdminTableMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return typeof data.uploadedAt === 'string' && typeof data.headers === 'object' && Array.isArray(data.rows);
}

function isLegacyAdminTablesCollection(value: unknown): value is AdminTablesCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isAdminTableMetadata);
}

function isAdminTablesStoreData(value: unknown): value is AdminTablesStoreData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  if (data.version !== ADMIN_TABLES_VERSION) {
    return false;
  }
  if (!data.tables || typeof data.tables !== 'object' || Array.isArray(data.tables)) {
    return false;
  }
  return Object.values(data.tables as Record<string, unknown>).every(isAdminTableMetadata);
}

function cloneAdminTableMetadata(metadata: AdminTableMetadata): AdminTableMetadata {
  return {
    uploadedAt: metadata.uploadedAt,
    headers: { ...metadata.headers },
    rows: metadata.rows.map((row) => ({ ...row }))
  };
}

export const adminTablesStore = new JsonStore<AdminTablesStoreData>({
  name: 'admin_tables',
  schemaKey: 'adminTables',
  defaultValue: () => ({ version: ADMIN_TABLES_VERSION, tables: {} }),
  migrate: (raw) => {
    if (isAdminTablesStoreData(raw)) {
      const tables = Object.fromEntries(
        Object.entries(raw.tables).map(([key, value]) => [key, cloneAdminTableMetadata(value)])
      );
      return { data: { version: ADMIN_TABLES_VERSION, tables }, migrated: false };
    }

    if (isLegacyAdminTablesCollection(raw)) {
      const tables = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [key, cloneAdminTableMetadata(value)])
      );
      return { data: { version: ADMIN_TABLES_VERSION, tables }, migrated: true };
    }

    throw new Error('Unsupported admin tables store format');
  }
});

export async function saveAdminTableMetadata(
  adminId: number,
  metadata: AdminTableMetadata
): Promise<void> {
  await adminTablesStore.update((state) => {
    const tables = {
      ...state.tables,
      [adminId.toString()]: cloneAdminTableMetadata(metadata)
    };
    return { version: ADMIN_TABLES_VERSION, tables };
  });
}

export async function getAdminTableMetadata(
  adminId: number
): Promise<AdminTableMetadata | undefined> {
  const state = await adminTablesStore.read();
  const metadata = state.tables[adminId.toString()];
  return metadata ? cloneAdminTableMetadata(metadata) : undefined;
}

export async function listAdminTables(): Promise<AdminTablesCollection> {
  const state = await adminTablesStore.read();
  return Object.fromEntries(
    Object.entries(state.tables).map(([key, value]) => [key, cloneAdminTableMetadata(value)])
  );
}

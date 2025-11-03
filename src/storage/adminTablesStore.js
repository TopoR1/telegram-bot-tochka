import { JsonStore } from './jsonStore.js';
const ADMIN_TABLES_VERSION = 2;
function isAdminTableMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    return typeof data.uploadedAt === 'string' && typeof data.headers === 'object' && Array.isArray(data.rows);
}
function isLegacyAdminTablesCollection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every(isAdminTableMetadata);
}
function isAdminTablesStoreData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    if (data.version !== ADMIN_TABLES_VERSION) {
        return false;
    }
    if (!data.tables || typeof data.tables !== 'object' || Array.isArray(data.tables)) {
        return false;
    }
    return Object.values(data.tables).every(isAdminTableMetadata);
}
function cloneAdminTableMetadata(metadata) {
    return {
        uploadedAt: metadata.uploadedAt,
        headers: { ...metadata.headers },
        rows: metadata.rows.map((row) => ({ ...row }))
    };
}
export const adminTablesStore = new JsonStore({
    name: 'admin_tables',
    schemaKey: 'adminTables',
    defaultValue: () => ({ version: ADMIN_TABLES_VERSION, tables: {} }),
    migrate: (raw) => {
        if (isAdminTablesStoreData(raw)) {
            const tables = Object.fromEntries(Object.entries(raw.tables).map(([key, value]) => [key, cloneAdminTableMetadata(value)]));
            return { data: { version: ADMIN_TABLES_VERSION, tables }, migrated: false };
        }
        if (isLegacyAdminTablesCollection(raw)) {
            const tables = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, cloneAdminTableMetadata(value)]));
            return { data: { version: ADMIN_TABLES_VERSION, tables }, migrated: true };
        }
        throw new Error('Unsupported admin tables store format');
    }
});
export async function saveAdminTableMetadata(adminId, metadata) {
    await adminTablesStore.update((state) => {
        const tables = {
            ...state.tables,
            [adminId.toString()]: cloneAdminTableMetadata(metadata)
        };
        return { version: ADMIN_TABLES_VERSION, tables };
    });
}
export async function getAdminTableMetadata(adminId) {
    const state = await adminTablesStore.read();
    const metadata = state.tables[adminId.toString()];
    return metadata ? cloneAdminTableMetadata(metadata) : undefined;
}
export async function listAdminTables() {
    const state = await adminTablesStore.read();
    return Object.fromEntries(Object.entries(state.tables).map(([key, value]) => [key, cloneAdminTableMetadata(value)]));
}

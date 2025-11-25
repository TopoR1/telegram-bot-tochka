import { describe, expect, it, vi } from 'vitest';

vi.mock('./dispatch.js', () => ({
    fetchCourierDeliveries: vi.fn(),
    recordDispatchedCards: vi.fn()
}));
vi.mock('../storage/index.js', () => ({
    courierStore: { read: vi.fn() }
}));
vi.mock('../storage/usersStore.js', () => ({
    getUser: vi.fn()
}));
vi.mock('../storage/adminTablesStore.js', () => ({
    listAdminTables: vi.fn()
}));

const { __private__ } = await import('./task-search.js');
const { findMatchingRow } = __private__;

describe('findMatchingRow', () => {
    it('skips phone matches with different names and continues searching', () => {
        const tables = {
            1: {
                uploadedAt: '2024-06-10T12:00:00Z',
                rows: [
                    {
                        id: 'foreign-payout',
                        phone: '+7 999 111-22-33',
                        normalizedFullName: 'петр петров',
                        earningsLastWeek: 1500
                    }
                ]
            },
            2: {
                uploadedAt: '2024-05-01T09:00:00Z',
                rows: [
                    {
                        id: 'target-payout',
                        phone: '+7 999 111-22-33',
                        normalizedFullName: 'иван иванов',
                        earningsLastWeek: 4200
                    }
                ]
            }
        };

        const match = findMatchingRow(tables, '+7 999 111-22-33', ['иван иванов']);

        expect(match?.row.id).toBe('target-payout');
        expect(match?.row.earningsLastWeek).toBe(4200);
    });

    it('matches phone when name in table is missing', () => {
        const tables = {
            1: {
                uploadedAt: '2024-06-10T12:00:00Z',
                rows: [
                    {
                        id: 'no-name-payout',
                        phone: '+7 999 111-22-33',
                        earningsLastWeek: 3100
                    }
                ]
            }
        };

        const match = findMatchingRow(tables, '+7 999 111-22-33', ['иван иванов']);

        expect(match?.row.id).toBe('no-name-payout');
        expect(match?.row.earningsLastWeek).toBe(3100);
    });
});

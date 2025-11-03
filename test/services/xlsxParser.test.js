import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import XLSX from 'xlsx';

vi.mock('uuid', () => {
  let counter = 0;
  return {
    v4: vi.fn(() => {
      counter += 1;
      return `uuid-${counter}`;
    }),
    __reset() {
      counter = 0;
    }
  };
});

const uuidModule = await import('uuid');
const uuidMock = uuidModule;

const { parseXlsx } = await import('../../src/services/xlsxParser.js');

describe('parseXlsx', () => {
  beforeEach(() => {
    uuidMock.__reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-05T12:34:56Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses workbook and normalizes card data', async () => {
    const rows = [
      ['Телефон', 'ФИО курьера', 'Выручка', 'Ссылка', 'Комментарий'],
      ['+7 (999) 111-22-33', 'иванов иван', '12 500 ₽', '@ivanov', 'Позвонить заранее'],
      ['8 999 222-33-44', 'Петров-Петрович Пётр', '13500', 'https://vk.com/test', '']
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Лист1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseXlsx(buffer, 777);

    expect(result.uploadedAt).toBe('2024-01-05T12:34:56.000Z');
    expect(result.cards).toHaveLength(2);

    expect(result.cards[0]).toMatchObject({
      id: 'uuid-1',
      adminId: 777,
      courierPhone: '89991112233',
      courierFullName: 'Иванов Иван',
      profileLink: 'https://t.me/ivanov',
      status: 'pending'
    });

    expect(result.cards[1]).toMatchObject({
      id: 'uuid-2',
      courierPhone: '89992223344',
      courierFullName: 'Петров Петрович Пётр',
      earningsLastWeek: 13500,
      profileLink: 'https://vk.com/test'
    });

    expect(result.headers).toMatchObject({
      phone: 'Телефон',
      fullName: 'ФИО курьера',
      earnings: 'Выручка',
      link: 'Ссылка',
      comment: 'Комментарий'
    });

    expect(result.rows[0]).toMatchObject({
      id: 'uuid-1',
      phone: '89991112233',
      normalizedFullName: 'иванов иван'
    });
  });
});

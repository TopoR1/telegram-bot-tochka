import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import XLSX from 'xlsx';

import { downloadFileBuffer } from '../../src/services/file-downloader.js';

describe('downloadFileBuffer', () => {
  let server;
  let serverUrl;
  let expectedBuffer;

  beforeAll(async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['id', 'value'],
      ['1', 'test']
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    expectedBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    server = createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Length': expectedBuffer.length
      });
      res.end(expectedBuffer);
    });

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    serverUrl = `http://127.0.0.1:${port}/file.xlsx`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('downloads binary XLSX content via fetch and preserves the payload', async () => {
    const buffer = await downloadFileBuffer(serverUrl);
    expect(buffer.equals(expectedBuffer)).toBe(true);
    expect(buffer.length).toBe(expectedBuffer.length);
  });
});

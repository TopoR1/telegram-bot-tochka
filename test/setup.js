import { beforeEach, afterEach, vi } from 'vitest';
import { fsExtraMock, fsPromisesMock, resetVirtualFs } from './helpers/virtualFs.js';

vi.mock('fs-extra', () => ({
  __esModule: true,
  default: fsExtraMock,
  ...fsExtraMock
}));

vi.mock('fs/promises', () => ({
  __esModule: true,
  ...fsPromisesMock
}));

beforeEach(() => {
  resetVirtualFs();
});

afterEach(() => {
  vi.clearAllMocks();
});

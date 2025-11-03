import path from 'path';
import { Volume, createFsFromVolume } from 'memfs';

const volume = new Volume();
const fs = createFsFromVolume(volume);
const promises = fs.promises;

function normalizeStructure(structure = {}) {
  const entries = Object.entries(structure ?? {});
  const normalized = {};
  for (const [filePath, content] of entries) {
    const absolute = path.posix.isAbsolute(filePath) ? filePath : path.posix.join('/', filePath);
    normalized[absolute] = content;
  }
  return normalized;
}

export function resetVirtualFs(structure = {}) {
  volume.reset();
  const normalized = normalizeStructure(structure);
  volume.fromJSON(normalized, '/');
}

async function ensureParentDir(target) {
  const dir = path.posix.dirname(target);
  await promises.mkdir(dir, { recursive: true });
}

async function ensureFile(target) {
  await ensureParentDir(target);
  try {
    await promises.access(target);
  }
  catch {
    await promises.writeFile(target, '', 'utf8');
  }
}

const fsExtraMock = {
  async ensureDir(dir) {
    await promises.mkdir(dir, { recursive: true });
  },
  async ensureFile(file) {
    await ensureFile(file);
  },
  async chmod() {
    // permissions are not simulated in the virtual filesystem
  },
  async appendFile(file, data, options) {
    await ensureParentDir(file);
    return promises.appendFile(file, data, options);
  },
  async writeFile(file, data, options) {
    await ensureParentDir(file);
    return promises.writeFile(file, data, options);
  },
  async copyFile(source, destination) {
    await ensureParentDir(destination);
    return promises.copyFile(source, destination);
  },
  async rename(source, destination) {
    await ensureParentDir(destination);
    return promises.rename(source, destination);
  },
  async remove(target) {
    return promises.rm(target, { recursive: true, force: true });
  },
  async readdir(dir) {
    try {
      return await promises.readdir(dir);
    }
    catch (err) {
      if (err && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  },
  async pathExists(target) {
    try {
      await promises.access(target);
      return true;
    }
    catch {
      return false;
    }
  },
  pathExistsSync(target) {
    try {
      fs.accessSync(target);
      return true;
    }
    catch {
      return false;
    }
  },
  existsSync(target) {
    try {
      fs.accessSync(target);
      return true;
    }
    catch {
      return false;
    }
  },
  readJsonSync(file) {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  },
  async readJson(file) {
    const raw = await promises.readFile(file, 'utf8');
    return JSON.parse(raw);
  },
  readFile: (file, options) => promises.readFile(file, options),
  ensureDirSync(dir) {
    fs.mkdirSync(dir, { recursive: true });
  },
  ensureFileSync(file) {
    const dir = path.posix.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.accessSync(file);
    }
    catch {
      fs.writeFileSync(file, '');
    }
  },
  writeFileSync(file, data, options) {
    const dir = path.posix.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, data, options);
  },
  readFileSync: (file, options) => fs.readFileSync(file, options),
  chmodSync() {
    // ignored in tests
  }
};

const PROMISE_METHODS = [
  'open',
  'access',
  'mkdir',
  'writeFile',
  'readFile',
  'appendFile',
  'copyFile',
  'rename',
  'rm',
  'readdir'
];

const fsPromisesMock = PROMISE_METHODS.reduce((acc, method) => {
  if (typeof promises[method] === 'function') {
    acc[method] = promises[method].bind(promises);
  }
  return acc;
}, {});

export function listVirtualDir(dir) {
  try {
    return fs.readdirSync(dir);
  }
  catch {
    return [];
  }
}

export function readVirtualFile(file, options = 'utf8') {
  return fs.readFileSync(file, options);
}

export { fsExtraMock, fsPromisesMock, volume as virtualVolume, fs as virtualFs };

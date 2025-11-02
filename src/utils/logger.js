import fs from 'fs-extra';
import dayjs from 'dayjs';
import { maskPhone } from './phone.js';
import { appConfig, resolveLogPath } from '../config.js';
const LOG_DIR = appConfig.logDir;
const AUDIT_FILE = resolveLogPath('audit.log');
async function ensureLogFile() {
    await fs.ensureDir(LOG_DIR, { mode: 0o700 });
    if (!(await fs.pathExists(AUDIT_FILE))) {
        await fs.ensureFile(AUDIT_FILE);
        await fs.chmod(AUDIT_FILE, 0o600);
    }
}
export async function writeAuditLog(event) {
    await ensureLogFile();
    const payload = {
        time: dayjs().toISOString(),
        name: event.name,
        userId: event.userId,
        phone: event.phone ? maskPhone(event.phone) : undefined,
        details: event.details
    };
    await fs.appendFile(AUDIT_FILE, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
}
export function logError(err) {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}

import fs from 'fs-extra';
import dayjs from 'dayjs';
import { maskPhone } from './phone.js';
import { appConfig, resolveLogPath } from '../config.js';
const LOG_DIR = appConfig.logDir;
const AUDIT_FILE = resolveLogPath('audit.log');
const VALIDATION_FILE = resolveLogPath('validation-errors.log');
async function ensureLogDir() {
    await fs.ensureDir(LOG_DIR, { mode: 0o700 });
}
async function ensureLogFile(filePath) {
    await ensureLogDir();
    if (!(await fs.pathExists(filePath))) {
        await fs.ensureFile(filePath);
        await fs.chmod(filePath, 0o600);
    }
}
export async function writeAuditLog(event) {
    await ensureLogFile(AUDIT_FILE);
    const payload = {
        time: dayjs().toISOString(),
        name: event.name,
        userId: event.userId,
        phone: event.phone ? maskPhone(event.phone) : undefined,
        details: event.details
    };
    await fs.appendFile(AUDIT_FILE, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
}
export async function logValidationErrorDetails(details) {
    await ensureLogFile(VALIDATION_FILE);
    const payload = {
        time: dayjs().toISOString(),
        store: details.store,
        action: details.action,
        filePath: details.filePath,
        summary: details.summary,
        totalErrors: details.totalErrors,
        examples: details.examples,
        fullText: details.fullText,
        errors: details.errors
    };
    await fs.appendFile(VALIDATION_FILE, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
}
export function logError(err) {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}

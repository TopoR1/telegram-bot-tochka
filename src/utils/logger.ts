import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';
import { maskPhone } from './phone.js';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const AUDIT_FILE = path.join(LOG_DIR, 'audit.log');

async function ensureLogFile(): Promise<void> {
  await fs.ensureDir(LOG_DIR, { mode: 0o700 });
  if (!(await fs.pathExists(AUDIT_FILE))) {
    await fs.ensureFile(AUDIT_FILE);
    await fs.chmod(AUDIT_FILE, 0o600);
  }
}

export type AuditEventName =
  | 'courier.register'
  | 'courier.reset'
  | 'courier.task_request'
  | 'delivery.sent'
  | 'delivery.failed'
  | 'admin.upload'
  | 'admin.announce'
  | 'admin.bind_group'
  | 'admin.upload_announcement'
  | 'system.start'
  | 'system.chat_update';

export interface AuditEvent {
  name: AuditEventName;
  userId?: number;
  phone?: string;
  details?: Record<string, unknown> | string;
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
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

export function logError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

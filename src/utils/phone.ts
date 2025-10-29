import { clamp } from 'lodash';

const PHONE_LENGTH = 11;

export const PHONE_BUTTON_LABEL = 'Отправить номер';

export function normalizePhone(input: string): string | null {
  const digits = (input.match(/\d+/g) || []).join('');
  if (!digits) return null;
  let normalized = digits;
  if (digits.length === 10) {
    normalized = `8${digits}`;
  }
  if (digits.length === PHONE_LENGTH && /^(7|8)/.test(digits)) {
    normalized = `8${digits.slice(1)}`;
  }
  if (normalized.length !== PHONE_LENGTH || !normalized.startsWith('8')) {
    return null;
  }
  return normalized;
}

export function maskPhone(phone: string): string {
  if (!phone) return '';
  const normalized = normalizePhone(phone) ?? phone;
  if (normalized.length !== PHONE_LENGTH) {
    return normalized.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
  }
  return `${normalized.slice(0, 2)}***${normalized.slice(5)}`;
}

export function comparePhones(a?: string | null, b?: string | null): boolean {
  const na = a ? normalizePhone(a) : null;
  const nb = b ? normalizePhone(b) : null;
  return Boolean(na && nb && na === nb);
}

export function scorePhoneMatch(phone: string, candidate: string): number {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCandidate = normalizePhone(candidate);
  if (!normalizedPhone || !normalizedCandidate) return 0;
  let score = 0;
  for (let i = 0; i < PHONE_LENGTH; i += 1) {
    if (normalizedPhone[i] === normalizedCandidate[i]) {
      score += 1;
    }
  }
  return clamp(score / PHONE_LENGTH, 0, 1);
}

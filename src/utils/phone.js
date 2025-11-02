import lodash from 'lodash';
const clamp = lodash.clamp;
const PHONE_LENGTH = 11;
export const PHONE_BUTTON_LABEL = 'Отправить номер';
export function normalizePhone(input) {
    if (!input)
        return null;
    const digits = input.replace(/\D+/g, '');
    if (!digits)
        return null;
    if (digits.length === PHONE_LENGTH) {
        if (digits.startsWith('8')) {
            return digits;
        }
        if (digits.startsWith('7')) {
            return `8${digits.slice(1)}`;
        }
    }
    if (digits.length === PHONE_LENGTH - 1) {
        return `8${digits}`;
    }
    return null;
}
export function maskPhone(phone) {
    if (!phone)
        return '';
    const normalized = normalizePhone(phone) ?? phone;
    if (normalized.length !== PHONE_LENGTH) {
        return normalized.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
    }
    return `${normalized.slice(0, 2)}***${normalized.slice(5)}`;
}
export function comparePhones(a, b) {
    const na = a ? normalizePhone(a) : null;
    const nb = b ? normalizePhone(b) : null;
    return Boolean(na && nb && na === nb);
}
export function scorePhoneMatch(phone, candidate) {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCandidate = normalizePhone(candidate);
    if (!normalizedPhone || !normalizedCandidate)
        return 0;
    let score = 0;
    for (let i = 0; i < PHONE_LENGTH; i += 1) {
        if (normalizedPhone[i] === normalizedCandidate[i]) {
            score += 1;
        }
    }
    return clamp(score / PHONE_LENGTH, 0, 1);
}

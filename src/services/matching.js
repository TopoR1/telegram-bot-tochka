import { normalizePhone, comparePhones } from '../utils/phone.js';
import { normalizeFullName } from '../utils/name.js';
function normalizeNameForMatching(raw) {
    return normalizeFullName(raw).replace(/\s+/g, ' ').toLowerCase();
}
export function isPhoneEqual(expected, actual) {
    if (!expected || !actual)
        return false;
    const normalizedExpected = normalizePhone(expected);
    const normalizedActual = normalizePhone(actual);
    if (!normalizedExpected || !normalizedActual) {
        return false;
    }
    return comparePhones(normalizedExpected, normalizedActual);
}
export function isFullNameEqual(expected, actual) {
    if (!expected || !actual)
        return false;
    return normalizeNameForMatching(expected) === normalizeNameForMatching(actual);
}
export function getCourierDisplayName(courier) {
    return courier.fullName ?? courier.lastName ?? courier.firstName ?? courier.username ?? undefined;
}
export function findCourierByPhone(collection, phone) {
    if (!phone)
        return undefined;
    const normalized = normalizePhone(phone);
    if (!normalized)
        return undefined;
    return Object.values(collection).find((courier) => courier.phone && isPhoneEqual(normalized, courier.phone));
}
export function findCourierByFullName(collection, fullName) {
    if (!fullName)
        return undefined;
    const normalized = normalizeNameForMatching(fullName);
    return Object.values(collection).find((courier) => {
        if (!courier.fullName)
            return false;
        return normalizeNameForMatching(courier.fullName) === normalized;
    });
}
export function findBestCourierMatch(collection, card) {
    const byPhone = findCourierByPhone(collection, card.courierPhone);
    if (byPhone) {
        return byPhone;
    }
    if (!card.courierPhone) {
        return findCourierByFullName(collection, card.courierFullName ?? card.customerName);
    }
    return undefined;
}

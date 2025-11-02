import { getCourierDeliveries, getDeliveryHistory, recordDeliveries } from '../storage/deliveriesStore.js';
export async function recordDispatchedCards(records) {
    await recordDeliveries(records);
}
export async function fetchCourierDeliveries(telegramId, limit) {
    const deliveries = await getCourierDeliveries(telegramId);
    if (typeof limit === 'number') {
        return deliveries.slice(0, Math.max(limit, 0));
    }
    return deliveries;
}
export async function listDeliveryHistory() {
    return getDeliveryHistory();
}

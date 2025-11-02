import dayjs from 'dayjs';
import { announcementStore } from '../storage/index.js';
import { getGroupBindings, setGroupBindings } from '../storage/groupBindingsStore.js';
export async function listGroupBindings(adminId) {
    return getGroupBindings(adminId);
}
export async function saveGroupBinding(adminId, binding) {
    const current = await getGroupBindings(adminId);
    const filtered = current.filter((item) => item.chatId !== binding.chatId ||
        (item.messageThreadId ?? 0) !== (binding.messageThreadId ?? 0));
    const next = [...filtered, { ...binding }];
    await setGroupBindings(adminId, next);
    return next;
}
export async function recordAnnouncement(adminId, target, message) {
    const payload = {
        adminId,
        target,
        message,
        sentAt: dayjs().toISOString()
    };
    await announcementStore.update((collection) => {
        collection.push(payload);
        return collection;
    });
    return payload;
}

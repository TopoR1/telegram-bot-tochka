import dayjs from 'dayjs';
import { announcementStore } from '../storage/index.js';
import { getGroupBindings, setGroupBindings } from '../storage/groupBindingsStore.js';
import { AnnouncementPayload, GroupBinding } from './types.js';

export async function listGroupBindings(adminId: number): Promise<GroupBinding[]> {
  return getGroupBindings(adminId);
}

export async function saveGroupBinding(
  adminId: number,
  binding: GroupBinding
): Promise<GroupBinding[]> {
  const current = await getGroupBindings(adminId);
  const filtered = current.filter(
    (item) =>
      item.chatId !== binding.chatId ||
      (item.messageThreadId ?? 0) !== (binding.messageThreadId ?? 0)
  );
  const next = [...filtered, { ...binding }];
  await setGroupBindings(adminId, next);
  return next;
}

export async function recordAnnouncement(
  adminId: number,
  target: GroupBinding,
  message: string
): Promise<AnnouncementPayload> {
  const payload: AnnouncementPayload = {
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

import { JsonStore } from './jsonStore.js';
import { GroupBinding } from '../services/types.js';

export type GroupBindingsState = Record<string, GroupBinding[]>;

const GROUP_BINDINGS_VERSION = 2;

interface LegacyGroupBinding {
  chatId: number;
  title: string;
  threadId?: number;
  messageThreadId?: number;
}

type LegacyGroupBindingsState = Record<string, LegacyGroupBinding[]>;

export interface GroupBindingsStoreData {
  version: number;
  bindings: GroupBindingsState;
}

function isGroupBinding(value: unknown): value is GroupBinding {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Record<string, unknown>;
  return (
    typeof data.chatId === 'number' &&
    typeof data.title === 'string' &&
    (data.messageThreadId === undefined || typeof data.messageThreadId === 'number')
  );
}

function isGroupBindingsState(value: unknown): value is GroupBindingsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (items) => Array.isArray(items) && items.every(isGroupBinding)
  );
}

function isLegacyGroupBinding(value: unknown): value is LegacyGroupBinding {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Record<string, unknown>;
  const hasThread = data.threadId === undefined || typeof data.threadId === 'number';
  const hasMessageThread =
    data.messageThreadId === undefined || typeof data.messageThreadId === 'number';
  return typeof data.chatId === 'number' && typeof data.title === 'string' && hasThread && hasMessageThread;
}

function isLegacyGroupBindingsState(value: unknown): value is LegacyGroupBindingsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (items) => Array.isArray(items) && items.every(isLegacyGroupBinding)
  );
}

function isGroupBindingsStoreData(value: unknown): value is GroupBindingsStoreData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return data.version === GROUP_BINDINGS_VERSION && isGroupBindingsState(data.bindings);
}

function isLegacyGroupBindingsStoreData(value: unknown): value is {
  version: number;
  bindings: LegacyGroupBindingsState;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return typeof data.version === 'number' && isLegacyGroupBindingsState(data.bindings);
}

function convertLegacyBinding(binding: LegacyGroupBinding): GroupBinding {
  const messageThreadId =
    binding.messageThreadId ?? (typeof binding.threadId === 'number' ? binding.threadId : undefined);
  const result: GroupBinding = {
    chatId: binding.chatId,
    title: binding.title
  };
  if (typeof messageThreadId === 'number') {
    result.messageThreadId = messageThreadId;
  }
  return result;
}

function convertLegacyState(state: LegacyGroupBindingsState): GroupBindingsState {
  return Object.fromEntries(
    Object.entries(state).map(([key, items]) => [key, items.map(convertLegacyBinding)])
  );
}

function cloneGroupBinding(binding: GroupBinding): GroupBinding {
  return { ...binding };
}

function cloneGroupBindingsState(state: GroupBindingsState): GroupBindingsState {
  return Object.fromEntries(
    Object.entries(state).map(([key, items]) => [key, items.map(cloneGroupBinding)])
  );
}

export const groupBindingsStore = new JsonStore<GroupBindingsStoreData>({
  name: 'groupBindings',
  schemaKey: 'groupBindings',
  defaultValue: () => ({ version: GROUP_BINDINGS_VERSION, bindings: {} }),
  migrate: (raw) => {
    if (isGroupBindingsStoreData(raw)) {
      return { data: { version: GROUP_BINDINGS_VERSION, bindings: cloneGroupBindingsState(raw.bindings) }, migrated: false };
    }

    if (isLegacyGroupBindingsStoreData(raw)) {
      return {
        data: { version: GROUP_BINDINGS_VERSION, bindings: convertLegacyState(raw.bindings) },
        migrated: raw.version !== GROUP_BINDINGS_VERSION
      };
    }

    if (isLegacyGroupBindingsState(raw)) {
      return {
        data: { version: GROUP_BINDINGS_VERSION, bindings: convertLegacyState(raw) },
        migrated: true
      };
    }

    throw new Error('Unsupported group bindings store format');
  }
});

export async function getGroupBindings(adminId: number): Promise<GroupBinding[]> {
  const state = await groupBindingsStore.read();
  const bindings = state.bindings[adminId.toString()] ?? [];
  return bindings.map(cloneGroupBinding);
}

export async function setGroupBindings(
  adminId: number,
  bindings: GroupBinding[]
): Promise<GroupBinding[]> {
  let result: GroupBinding[] = [];
  await groupBindingsStore.update((state) => {
    const next = bindings.map(cloneGroupBinding);
    result = next;
    return {
      version: GROUP_BINDINGS_VERSION,
      bindings: {
        ...state.bindings,
        [adminId.toString()]: next
      }
    };
  });
  return result;
}

import { JsonStore } from './jsonStore.js';
import { GroupBinding } from '../services/types.js';

export type GroupBindingsState = Record<string, GroupBinding[]>;

const GROUP_BINDINGS_VERSION = 1;

export interface GroupBindingsStoreData {
  version: number;
  bindings: GroupBindingsState;
}

function isGroupBinding(value: unknown): value is GroupBinding {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const data = value as Record<string, unknown>;
  return typeof data.chatId === 'number' && typeof data.title === 'string';
}

function isGroupBindingsState(value: unknown): value is GroupBindingsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (items) => Array.isArray(items) && items.every(isGroupBinding)
  );
}

function isGroupBindingsStoreData(value: unknown): value is GroupBindingsStoreData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const data = value as Record<string, unknown>;
  return data.version === GROUP_BINDINGS_VERSION && isGroupBindingsState(data.bindings);
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

    if (isGroupBindingsState(raw)) {
      return { data: { version: GROUP_BINDINGS_VERSION, bindings: cloneGroupBindingsState(raw) }, migrated: true };
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

import { JsonStore } from './jsonStore.js';
const GROUP_BINDINGS_VERSION = 2;
function isGroupBinding(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const data = value;
    return (typeof data.chatId === 'number' &&
        typeof data.title === 'string' &&
        (data.messageThreadId === undefined || typeof data.messageThreadId === 'number'));
}
function isGroupBindingsState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every((items) => Array.isArray(items) && items.every(isGroupBinding));
}
function isLegacyGroupBinding(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const data = value;
    const hasThread = data.threadId === undefined || typeof data.threadId === 'number';
    const hasMessageThread = data.messageThreadId === undefined || typeof data.messageThreadId === 'number';
    return typeof data.chatId === 'number' && typeof data.title === 'string' && hasThread && hasMessageThread;
}
function isLegacyGroupBindingsState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return Object.values(value).every((items) => Array.isArray(items) && items.every(isLegacyGroupBinding));
}
function isGroupBindingsStoreData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    return data.version === GROUP_BINDINGS_VERSION && isGroupBindingsState(data.bindings);
}
function isLegacyGroupBindingsStoreData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const data = value;
    return typeof data.version === 'number' && isLegacyGroupBindingsState(data.bindings);
}
function convertLegacyBinding(binding) {
    const messageThreadId = binding.messageThreadId ?? (typeof binding.threadId === 'number' ? binding.threadId : undefined);
    const result = {
        chatId: binding.chatId,
        title: binding.title
    };
    if (typeof messageThreadId === 'number') {
        result.messageThreadId = messageThreadId;
    }
    return result;
}
function convertLegacyState(state) {
    return Object.fromEntries(Object.entries(state).map(([key, items]) => [key, items.map(convertLegacyBinding)]));
}
function cloneGroupBinding(binding) {
    return { ...binding };
}
function cloneGroupBindingsState(state) {
    return Object.fromEntries(Object.entries(state).map(([key, items]) => [key, items.map(cloneGroupBinding)]));
}
export const groupBindingsStore = new JsonStore({
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
export async function getGroupBindings(adminId) {
    const state = await groupBindingsStore.read();
    const bindings = state.bindings[adminId.toString()] ?? [];
    return bindings.map(cloneGroupBinding);
}
export async function setGroupBindings(adminId, bindings) {
    let result = [];
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

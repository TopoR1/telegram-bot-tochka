import { JsonStore } from './jsonStore.js';
import { GroupBinding } from '../services/types.js';

export type GroupBindingsState = Record<string, GroupBinding[]>;

export const groupBindingsStore = new JsonStore<GroupBindingsState>({
  name: 'groupBindings',
  schemaKey: 'groupBindings',
  defaultValue: () => ({})
});

export async function getGroupBindings(adminId: number): Promise<GroupBinding[]> {
  const state = await groupBindingsStore.read();
  return [...(state[adminId.toString()] ?? [])];
}

export async function setGroupBindings(
  adminId: number,
  bindings: GroupBinding[]
): Promise<GroupBinding[]> {
  let result: GroupBinding[] = [];
  await groupBindingsStore.update((state) => {
    const next = bindings.map((binding) => ({ ...binding }));
    state[adminId.toString()] = next;
    result = next;
    return state;
  });
  return result;
}

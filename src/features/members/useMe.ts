import { useSyncExternalStore } from 'react';

// "This is me": which member the person using this browser tab is.
// There is no login, so it is only a convenience (a shortcut to your own page, a "You"
// label), never a permission. It is kept in sessionStorage: it survives reloads, and is
// forgotten when the tab is closed. Each tab has its own.

const key = (groupId: string) => `me:${groupId}`;
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(groupId: string): string | null {
  try {
    return sessionStorage.getItem(key(groupId));
  } catch {
    return memory.get(groupId) ?? null;
  }
}

function write(groupId: string, memberId: string | null) {
  try {
    if (memberId) sessionStorage.setItem(key(groupId), memberId);
    else sessionStorage.removeItem(key(groupId));
  } catch {
    if (memberId) memory.set(groupId, memberId);
    else memory.delete(groupId);
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The member this tab is "being" in one group: `memberId` is null until someone picks. */
export function useMe(groupId: string | undefined) {
  const memberId = useSyncExternalStore(subscribe, () => (groupId ? read(groupId) : null));
  return {
    memberId,
    become: (id: string) => groupId && write(groupId, id),
    clear: () => groupId && write(groupId, null),
  };
}

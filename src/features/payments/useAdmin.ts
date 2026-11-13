import { useSyncExternalStore } from 'react';

// The unlocked admin passcode is kept for this browser tab only (sessionStorage),
// so closing the tab locks admin mode again. The database re-checks it on every action.

const key = (groupId: string) => `adminCode:${groupId}`;
const listeners = new Set<() => void>();

function read(groupId: string): string | null {
  try {
    return sessionStorage.getItem(key(groupId));
  } catch {
    return memory.get(groupId) ?? null;
  }
}
const memory = new Map<string, string>();

function write(groupId: string, code: string | null) {
  try {
    if (code) sessionStorage.setItem(key(groupId), code);
    else sessionStorage.removeItem(key(groupId));
  } catch {
    if (code) memory.set(groupId, code);
    else memory.delete(groupId);
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Admin mode for one group: `code` is the unlocked passcode, or null. */
export function useAdmin(groupId: string | undefined) {
  const code = useSyncExternalStore(subscribe, () => (groupId ? read(groupId) : null));
  return {
    code,
    isAdmin: !!code,
    unlock: (c: string) => groupId && write(groupId, c),
    lock: () => groupId && write(groupId, null),
  };
}

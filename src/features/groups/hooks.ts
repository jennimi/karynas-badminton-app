import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { getGroup, getOrCreateDefaultGroup } from './api';

// ---- Selected group (remembered per browser) -------------------------------

const KEY = 'currentGroupId';
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let selectedId: string | null = readStored();

export function setCurrentGroupId(id: string) {
  if (id === selectedId) return;
  selectedId = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable: selection still works for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCurrentGroupId(): string | null {
  return useSyncExternalStore(subscribe, () => selectedId);
}

/** Make `groupId` the current group (e.g. when opening a group or one of its sessions). */
export function useSyncCurrentGroup(groupId: string | undefined) {
  useEffect(() => {
    if (groupId) setCurrentGroupId(groupId);
  }, [groupId]);
}

/**
 * The group the app currently works in (Sessions, Members, …).
 * Picked in the sidebar; falls back to the first group if none is selected
 * or the selected one was deleted.
 */
export function useCurrentGroup() {
  const id = useCurrentGroupId();
  return useQuery({
    queryKey: ['currentGroup', id],
    queryFn: async () => {
      if (id) {
        try {
          return await getGroup(id);
        } catch {
          /* selected group no longer exists: fall back below */
        }
      }
      return getOrCreateDefaultGroup();
    },
    placeholderData: (prev) => prev,
  });
}

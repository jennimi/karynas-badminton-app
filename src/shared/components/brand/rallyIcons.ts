import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../supabase';

/**
 * The Rally icons: the 12 tiles in design/Rally Shuttlecock Icon Collection.png, cut out into
 * public/brand/rally-01.png ... rally-12.png by scripts/extract-brand-icons.py.
 *
 * Which one the app uses is a shared setting (table `app_settings`, changed on the Design kit
 * page with the admin passcode). DEFAULT_ICON is used until one is chosen.
 */
export const RALLY_ICONS = [
  { id: 'rally-01', label: 'Lavender swoosh' },
  { id: 'rally-02', label: 'Cream spark' },
  { id: 'rally-03', label: 'Lime orbit' },
  { id: 'rally-04', label: 'Midnight' },
  { id: 'rally-05', label: 'Cream speed' },
  { id: 'rally-06', label: 'Lavender arc' },
  { id: 'rally-07', label: 'Midnight gold' },
  { id: 'rally-08', label: 'Lilac outline' },
  { id: 'rally-09', label: 'Midnight arc' },
  { id: 'rally-10', label: 'Lime bold' },
  { id: 'rally-11', label: 'Cream trail' },
  { id: 'rally-12', label: 'Lavender swirl' },
] as const;

export type RallyIconId = (typeof RALLY_ICONS)[number]['id'];

/** Used until the admin picks one. */
export const DEFAULT_ICON: RallyIconId = 'rally-01';

export const iconSrc = (id: RallyIconId) => `/brand/${id}.png`;

const isIcon = (v: unknown): v is RallyIconId => RALLY_ICONS.some((i) => i.id === v);

// The last known choice is remembered in this browser so the right icon shows
// instantly (tab icon + loading splash read it too, see index.html).
const CACHE_KEY = 'rallyIcon';

function cached(): RallyIconId | null {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isIcon(v) ? v : null;
  } catch {
    return null;
  }
}

export function remember(id: RallyIconId) {
  try {
    localStorage.setItem(CACHE_KEY, id);
  } catch {
    /* storage unavailable: the icon just won't be pre-loaded next time */
  }
}

async function fetchAppIcon(): Promise<RallyIconId> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'app_icon').maybeSingle();
  // If the table isn't there yet (migration 007 not run) or the call fails: keep what we have.
  const id = !error && isIcon(data?.value) ? data.value : (cached() ?? DEFAULT_ICON);
  remember(id);
  return id;
}

/** The icon the whole app currently uses. */
export function useRallyIcon(): RallyIconId {
  const { data } = useQuery({
    queryKey: ['appIcon'],
    queryFn: fetchAppIcon,
    initialData: cached() ?? DEFAULT_ICON,
    initialDataUpdatedAt: 0, // always re-check the server in the background
    staleTime: 5 * 60_000,
  });
  return data;
}

/** Admin only (the database checks the passcode). */
export async function saveAppIcon(groupId: string, icon: RallyIconId, code: string) {
  const { error } = await supabase.rpc('set_app_icon', { p_group: groupId, p_icon: icon, p_code: code });
  if (error) {
    if (/set_app_icon|schema cache|does not exist/i.test(error.message)) {
      throw new Error('Run supabase/migrations/007_app_settings.sql in the Supabase SQL Editor first.');
    }
    throw new Error(error.message);
  }
  remember(icon);
}

/** Keeps the browser-tab icon (and iOS home-screen icon) in step with the chosen icon. */
export function useSyncFavicon() {
  const icon = useRallyIcon();
  useEffect(() => {
    for (const rel of ['icon', 'apple-touch-icon']) {
      const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (link) link.href = iconSrc(icon);
    }
  }, [icon]);
}

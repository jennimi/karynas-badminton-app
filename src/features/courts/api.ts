import { supabase } from '../../shared/supabase';
import type { GroupVenue } from '../../shared/types';
import { friendlyRpcError } from '../../shared/utils/rpcError';
import type { Availability } from './availability';

const MIGRATION = '012_group_venues.sql';

// ---- The group's saved venues (Supabase) -----------------------------------

export async function getGroupVenues(groupId: string): Promise<GroupVenue[]> {
  const { data, error } = await supabase
    .from('group_venues')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });
  if (error) throw friendlyRpcError(error.message, MIGRATION);
  return data ?? [];
}

/** "https://ayo.co/v/weston-sports?x=1" or just "weston-sports" → "weston-sports". */
export function parseAyoSlug(input: string): string | null {
  const text = input.trim();
  const fromLink = /ayo\.co(?:\.id)?\/v\/([a-z0-9-]+)/i.exec(text)?.[1];
  const slug = fromLink ?? (/^[a-z0-9][a-z0-9-]*$/i.test(text) ? text : null);
  return slug ? slug.toLowerCase() : null;
}

/** Looks the venue up on AYO, then saves it for the group. */
export async function addGroupVenue(groupId: string, link: string): Promise<GroupVenue> {
  const slug = parseAyoSlug(link);
  if (!slug) throw new Error('Paste the venue’s AYO link, e.g. https://ayo.co/v/weston-sports');
  const info = await ayoRequest<{ venueId: number; slug: string; name: string }>(
    `slug=${encodeURIComponent(slug)}`
  );
  const { data, error } = await supabase
    .from('group_venues')
    .insert({ group_id: groupId, name: info.name, ayo_slug: info.slug, ayo_venue_id: info.venueId })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error(`${info.name} is already on the list.`);
    throw friendlyRpcError(error.message, MIGRATION);
  }
  return data;
}

export async function removeGroupVenue(id: string): Promise<void> {
  const { error } = await supabase.from('group_venues').delete().eq('id', id);
  if (error) throw friendlyRpcError(error.message, MIGRATION);
}

// ---- Live availability from AYO (through our /api/ayo function) ------------

async function ayoRequest<T>(query: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/ayo?${query}`);
  } catch {
    throw new Error('Could not reach the server. Check your connection.');
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? 'Could not read AYO right now.');
  return body;
}

export function getAvailability(ayoVenueId: number, date: string): Promise<Availability> {
  return ayoRequest<Availability>(`venue=${ayoVenueId}&date=${date}`);
}

export const ayoVenueUrl = (slug: string) => `https://ayo.co/v/${slug}`;

-- 012: the venues each group usually plays at, for the Courts page (availability from AYO).
-- Run in Supabase -> SQL Editor. Safe to run more than once.
-- (011 is reserved for Gavin's tournament tables.)
--
-- A venue is one place on ayo.co, e.g. https://ayo.co/v/weston-sports
--   ayo_slug     = "weston-sports" (the end of that link)
--   ayo_venue_id = AYO's own number for the venue (728), which its availability data is asked by

create table if not exists group_venues (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  ayo_slug text not null,
  ayo_venue_id integer not null,
  created_at timestamptz not null default now(),
  unique (group_id, ayo_venue_id)
);

create index if not exists group_venues_group_idx on group_venues (group_id);

-- Open like sessions and members (no login yet).
alter table group_venues enable row level security;
drop policy if exists "Allow all on group_venues" on group_venues;
create policy "Allow all on group_venues" on group_venues for all using (true) with check (true);


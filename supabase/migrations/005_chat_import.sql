-- 005: shared state for the "Chat history" page (sessions found in the WhatsApp chat).
-- Run in Supabase -> SQL Editor AFTER 004. Safe to run more than once.

-- Who is each chat nickname? Shared, so everyone who opens the page sees the same matches.
-- `before_date`/`before_target`: "before this date the nickname meant someone else"
-- (e.g. "theo" was Theodore Budi before October).
create table if not exists chat_name_map (
  group_id uuid not null references groups(id) on delete cascade,
  core text not null,
  target jsonb not null,           -- {"kind":"member","id":"…"} | {"kind":"new","name":"…"} | {"kind":"skip"}
  confirmed boolean not null default false,
  before_date date,
  before_target jsonb,
  updated_at timestamptz not null default now(),
  primary key (group_id, core)
);

-- Which session found in the chat became which real session, plus per-session member changes.
create table if not exists chat_links (
  group_id uuid not null references groups(id) on delete cascade,
  draft_key text not null,         -- stable id of the session found in the chat (its date)
  session_id uuid references sessions(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'imported', 'skipped')),
  overrides jsonb not null default '{}',   -- {"theo": {"kind":"member","id":"…"}} for this session only
  updated_at timestamptz not null default now(),
  primary key (group_id, draft_key)
);

alter table chat_name_map enable row level security;
alter table chat_links enable row level security;
drop policy if exists "Allow all on chat_name_map" on chat_name_map;
drop policy if exists "Allow all on chat_links" on chat_links;
create policy "Allow all on chat_name_map" on chat_name_map for all using (true) with check (true);
create policy "Allow all on chat_links" on chat_links for all using (true) with check (true);

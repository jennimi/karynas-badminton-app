-- 009: matches inside a session (who played whom, and the score).
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- A match belongs to a session. Its players are in match_players with a team (A or B):
-- two per team for doubles, one per team for singles. The score is one number per team
-- (e.g. 21 and 18) and may be empty until the game is finished.

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round integer not null,                 -- game number within the session: 1, 2, 3...
  court integer,                          -- optional court number
  score_a integer check (score_a is null or score_a >= 0),
  score_b integer check (score_b is null or score_b >= 0),
  created_at timestamptz not null default now()
);

create table if not exists match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  team text not null check (team in ('A', 'B')),
  unique (match_id, member_id)
);

create index if not exists idx_matches_session on matches(session_id);
create index if not exists idx_match_players_match on match_players(match_id);
create index if not exists idx_match_players_member on match_players(member_id);

-- Same open access as sessions (no login yet): anyone using the app can add matches.
alter table matches enable row level security;
alter table match_players enable row level security;
drop policy if exists "Allow all on matches" on matches;
drop policy if exists "Allow all on match_players" on match_players;
create policy "Allow all on matches" on matches for all using (true) with check (true);
create policy "Allow all on match_players" on match_players for all using (true) with check (true);

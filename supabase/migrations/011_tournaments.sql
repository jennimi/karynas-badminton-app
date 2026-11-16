-- ============================================
-- 011: Single-Elimination Doubles Tournaments
-- Supports Doubles Pairs (Group Members + Guests),
-- Instant Winner Selection, and Editable Scores
-- ============================================

drop table if exists tournament_matches cascade;
drop table if exists tournament_participants cascade;
drop table if exists tournaments cascade;

-- 1. Tournaments
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

-- 2. Tournament Participants (Doubles Pairs: Group Members or Guests)
create table tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  seed integer,
  player1_name text not null,
  player2_name text not null,
  member_id uuid references members(id) on delete set null,
  partner_member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Tournament Matches
create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round integer not null,
  match_order integer not null,
  court integer,
  participant1_id uuid references tournament_participants(id) on delete set null,
  participant2_id uuid references tournament_participants(id) on delete set null,
  score_1 integer,
  score_2 integer,
  winner_id uuid references tournament_participants(id) on delete set null,
  next_match_id uuid references tournament_matches(id) on delete set null,
  next_match_slot integer check (next_match_slot in (1, 2)),
  created_at timestamptz not null default now()
);

-- Performance indexes on foreign keys
create index idx_tournaments_group on tournaments(group_id);
create index idx_tournament_participants_tournament on tournament_participants(tournament_id);
create index idx_tournament_participants_member on tournament_participants(member_id);
create index idx_tournament_participants_partner on tournament_participants(partner_member_id);
create index idx_tournament_matches_tournament on tournament_matches(tournament_id);
create index idx_tournament_matches_next_match on tournament_matches(next_match_id);
create index idx_tournament_matches_p1 on tournament_matches(participant1_id);
create index idx_tournament_matches_p2 on tournament_matches(participant2_id);
create index idx_tournament_matches_winner on tournament_matches(winner_id);

-- Row-Level Security (permissive public access matching 001_initial_schema.sql)
alter table tournaments enable row level security;
alter table tournament_participants enable row level security;
alter table tournament_matches enable row level security;

create policy "Allow all on tournaments" on tournaments for all using (true) with check (true);
create policy "Allow all on tournament_participants" on tournament_participants for all using (true) with check (true);
create policy "Allow all on tournament_matches" on tournament_matches for all using (true) with check (true);

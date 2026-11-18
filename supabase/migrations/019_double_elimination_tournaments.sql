-- ============================================
-- 019: Double Elimination Tournaments
-- Adds tournament format selection, Grand Final Reset toggle,
-- match bracket types, and loser-bracket drop routing links.
-- 100% backward compatible with 011_tournaments.sql & 016.
-- ============================================

-- 1. Extend tournaments with format and grand final reset configuration
alter table tournaments
  add column if not exists format text not null default 'single_elimination'
    check (format in ('single_elimination', 'double_elimination')),
  add column if not exists has_grand_final_reset boolean not null default true;

-- 2. Extend tournament_matches with bracket_type and loser routing pointers
alter table tournament_matches
  add column if not exists bracket_type text not null default 'winner'
    check (bracket_type in ('winner', 'loser', 'grand_final', 'grand_final_reset')),
  add column if not exists loser_match_id uuid references tournament_matches(id) on delete set null,
  add column if not exists loser_match_slot integer
    check (loser_match_slot in (1, 2));

-- 3. Performance indexes for bracket traversal and loser drop lookups
create index if not exists idx_tournament_matches_loser_match
  on tournament_matches(loser_match_id);

create index if not exists idx_tournament_matches_bracket_type
  on tournament_matches(tournament_id, bracket_type, round, match_order);

-- 010: only the admin can delete sessions, members and matches.
-- Run in Supabase -> SQL Editor, AFTER 004 (admin passcode) and 009 (matches). Safe to run more than once.
--
-- Before this, anyone with the app address could delete these straight through the API (there is no
-- login). Now direct deletes on these three tables are switched off, and the only way to delete is
-- through the functions below, which check the group's admin passcode inside the database.
-- (Removing someone from a session, or a team from a match, is editing, and stays open to everyone.)

revoke delete on sessions from anon, authenticated;
revoke delete on members from anon, authenticated;
revoke delete on matches from anon, authenticated;

create or replace function delete_session(p_session uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare g uuid;
begin
  select group_id into g from sessions where id = p_session;
  if g is null then return; end if;                       -- already gone
  if not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Only the admin can delete sessions';
  end if;
  delete from sessions where id = p_session;
end $$;

create or replace function delete_member(p_member uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare g uuid;
begin
  select group_id into g from members where id = p_member;
  if g is null then return; end if;
  if not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Only the admin can delete members';
  end if;
  delete from members where id = p_member;
end $$;

create or replace function delete_match(p_match uuid, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare g uuid;
begin
  select s.group_id into g from matches m join sessions s on s.id = m.session_id where m.id = p_match;
  if g is null then return; end if;
  if not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Only the admin can delete matches';
  end if;
  delete from matches where id = p_match;
end $$;

-- Adding a match used to clean up after itself with a delete when saving failed halfway.
-- That delete is gone now, so a match and its players are created together in one step instead.
create or replace function create_match(
  p_session uuid, p_round integer, p_court integer,
  p_score_a integer, p_score_b integer, p_team_a uuid[], p_team_b uuid[]
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare g uuid; mid uuid;
begin
  select group_id into g from sessions where id = p_session;
  if g is null then raise exception 'Session not found'; end if;
  if coalesce(array_length(p_team_a, 1), 0) = 0 or coalesce(array_length(p_team_a, 1), 0) <> coalesce(array_length(p_team_b, 1), 0)
     or array_length(p_team_a, 1) > 2 then
    raise exception 'Each team needs the same number of players (1 or 2)';
  end if;
  if exists (select 1 from members where id = any (p_team_a || p_team_b) and group_id <> g) then
    raise exception 'Players must belong to this group';
  end if;
  insert into matches (session_id, round, court, score_a, score_b)
  values (p_session, p_round, p_court, p_score_a, p_score_b) returning id into mid;
  insert into match_players (match_id, member_id, team)
  select mid, m, 'A' from unnest(p_team_a) as m
  union all
  select mid, m, 'B' from unnest(p_team_b) as m;
  return mid;
end $$;

grant execute on function delete_session(uuid, text), delete_member(uuid, text), delete_match(uuid, text),
  create_match(uuid, integer, integer, integer, integer, uuid[], uuid[]) to anon, authenticated;

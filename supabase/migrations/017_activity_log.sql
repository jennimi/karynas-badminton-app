-- 017: activity log. Every change to sessions, payments, members, matches, tournaments and
-- settings is written down: what changed, when, and who did it.
-- Run in Supabase -> SQL Editor. Safe to run more than once. Works whichever of the
-- earlier migrations you have run (a table that doesn't exist yet is simply skipped).
--
-- HOW IT WORKS
--  * Database triggers write the log, so EVERY change is caught, whichever screen made it.
--  * "Who": the app sends the member picked in "Who are you?" with every request (header
--    x-rally-actor). There is no login yet, so this is self-declared: it says who the person
--    SAID they were. Nobody picked? It's recorded as "Someone". Changes made directly in the
--    Supabase SQL Editor have no header, so they show as "Someone" too.
--  * Nobody can edit or delete log entries from the app (writes are switched off). They can only read.

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  group_id uuid references groups(id) on delete cascade,
  actor_member_id uuid,   -- the member the person said they were (no foreign key: the log outlives members)
  actor_name text,        -- their name at the time
  entity text not null check (entity in ('session', 'participant', 'payment', 'member', 'match', 'tournament', 'venue', 'setting')),
  action text not null,   -- created | updated | deleted | added | left | status | cost | ...
  session_id uuid,        -- the session it is about, to link to it (no foreign key: survives deleting the session)
  member_id uuid,         -- the member it is about
  summary text not null,  -- plain-English line shown in the app
  details jsonb not null default '{}'
);

create index if not exists idx_activity_group_at on activity_log (group_id, at desc);
create index if not exists idx_activity_session on activity_log (session_id) where session_id is not null;
create index if not exists idx_activity_member on activity_log (member_id) where member_id is not null;

alter table activity_log enable row level security;
drop policy if exists "Anyone can read activity_log" on activity_log;
create policy "Anyone can read activity_log" on activity_log for select using (true);
revoke insert, update, delete on activity_log from anon, authenticated;

-- ---------- helpers ----------

-- "12 Nov 2026"
create or replace function _d(d date) returns text language sql immutable as $$
  select to_char(d, 'FMDD Mon YYYY');
$$;

-- Costs are stored in thousands and shown that way in the app: 208 -> "Rp 208", 362.5 -> "Rp 362,5"
create or replace function _rp(thousands numeric) returns text language sql immutable as $$
  select 'Rp ' || replace(trim_scale(round(thousands, 3))::text, '.', ',');
$$;

-- Writes one line to the log. The actor comes from the request header the app sends.
create or replace function _log(
  p_group uuid, p_entity text, p_action text, p_summary text,
  p_session uuid default null, p_member uuid default null, p_details jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare h json; actor uuid; actor_nm text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  begin actor := nullif(h ->> 'x-rally-actor', '')::uuid; exception when others then actor := null; end;
  if actor is not null then
    select name into actor_nm from members where id = actor;
    if actor_nm is null then actor := null; end if;   -- not a real member: don't pretend
  end if;
  insert into activity_log (group_id, actor_member_id, actor_name, entity, action, session_id, member_id, summary, details)
  values (p_group, actor, actor_nm, p_entity, p_action, p_session, p_member, p_summary, coalesce(p_details, '{}'));
end $$;

revoke all on function _log(uuid, text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function _d(date), _rp(numeric) from public, anon, authenticated;

-- ---------- one trigger function per table ----------

create or replace function log_sessions() returns trigger language plpgsql security definer set search_path = public as $$
declare chg text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform _log(new.group_id, 'session', 'created',
      'Created the ' || _d(new.date) || ' session' || coalesce(' at ' || new.location, ''),
      new.id, null, jsonb_build_object('date', new.date));
  elsif tg_op = 'UPDATE' then
    if new.date is distinct from old.date then chg := chg || ('date ' || _d(old.date) || ' → ' || _d(new.date))::text; end if;
    if new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time then chg := chg || 'time'::text; end if;
    if new.location is distinct from old.location then chg := chg || 'location'::text; end if;
    if new.courts is distinct from old.courts then chg := chg || 'courts'::text; end if;
    if new.title is distinct from old.title then chg := chg || 'title'::text; end if;
    if new.notes is distinct from old.notes then chg := chg || 'notes'::text; end if;
    if cardinality(chg) > 0 then
      perform _log(new.group_id, 'session', 'updated',
        'Edited the ' || _d(new.date) || ' session (' || array_to_string(chg, ', ') || ')', new.id);
    end if;
    if new.total_cost is distinct from old.total_cost then
      perform _log(new.group_id, 'payment', 'cost',
        case when new.total_cost is null then 'Cleared the cost of the ' || _d(new.date) || ' session'
             else 'Set the cost of the ' || _d(new.date) || ' session to ' || _rp(new.total_cost) end,
        new.id, null, jsonb_build_object('from', old.total_cost, 'to', new.total_cost, 'date', new.date));
    end if;
  else
    perform _log(old.group_id, 'session', 'deleted', 'Deleted the ' || _d(old.date) || ' session', old.id, null,
      jsonb_build_object('date', old.date));
  end if;
  return null;
end $$;

create or replace function log_participants() returns trigger language plpgsql security definer set search_path = public as $$
declare sdate date; sgroup uuid; sid uuid; mid uuid; mname text; label text;
begin
  -- INSERT has no OLD row and DELETE has no NEW row: only read the one that exists
  if tg_op = 'DELETE' then sid := old.session_id; mid := old.member_id;
  else sid := new.session_id; mid := new.member_id; end if;
  select date, group_id into sdate, sgroup from sessions where id = sid;
  select name into mname from members where id = mid;
  -- the session or member is already gone (it is being deleted, and that is logged on its own): stay quiet
  if sdate is null or mname is null then return null; end if;

  if tg_op = 'INSERT' then
    perform _log(sgroup, 'participant', 'added', mname || ' joined the ' || _d(sdate) || ' session', sid, mid,
      jsonb_build_object('member', mname, 'date', sdate));
  elsif tg_op = 'DELETE' then
    perform _log(sgroup, 'participant', 'left', 'Removed ' || mname || ' from the ' || _d(sdate) || ' session', sid, mid,
      jsonb_build_object('member', mname, 'date', sdate));
  elsif new.payment_status is distinct from old.payment_status then
    label := case new.payment_status when 'approved' then 'approved' when 'pending' then 'paid, waiting approval' else 'not paid' end;
    perform _log(sgroup, 'payment', 'status', mname || ': ' || label || ' (' || _d(sdate) || ' session)', sid, mid,
      jsonb_build_object('member', mname, 'from', old.payment_status, 'to', new.payment_status, 'date', sdate));
  end if;
  return null;
end $$;

create or replace function log_members() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform _log(new.group_id, 'member', 'created', 'Added member ' || new.name, null, new.id, jsonb_build_object('member', new.name));
  elsif tg_op = 'UPDATE' then
    if new.name is distinct from old.name then
      perform _log(new.group_id, 'member', 'renamed', 'Renamed ' || old.name || ' to ' || new.name, null, new.id,
        jsonb_build_object('from', old.name, 'to', new.name));
    end if;
    if new.emoji is distinct from old.emoji or new.color is distinct from old.color then
      perform _log(new.group_id, 'member', 'updated', 'Changed the look of ' || new.name, null, new.id, jsonb_build_object('member', new.name));
    end if;
  else
    perform _log(old.group_id, 'member', 'deleted', 'Removed member ' || old.name, null, old.id, jsonb_build_object('member', old.name));
  end if;
  return null;
end $$;

create or replace function log_matches() returns trigger language plpgsql security definer set search_path = public as $$
declare sdate date; sgroup uuid; sid uuid; r integer;
begin
  if tg_op = 'DELETE' then sid := old.session_id; r := old.round;
  else sid := new.session_id; r := new.round; end if;
  select date, group_id into sdate, sgroup from sessions where id = sid;
  if sdate is null then return null; end if;   -- the whole session is being deleted

  if tg_op = 'INSERT' then
    perform _log(sgroup, 'match', 'created', 'Added game ' || r || ' to the ' || _d(sdate) || ' session', sid);
  elsif tg_op = 'UPDATE' then
    if new.score_a is distinct from old.score_a or new.score_b is distinct from old.score_b or new.court is distinct from old.court then
      perform _log(sgroup, 'match', 'updated',
        'Updated game ' || r || ' of the ' || _d(sdate) || ' session' ||
          case when new.score_a is not null and new.score_b is not null then ' (score ' || new.score_a || '–' || new.score_b || ')' else '' end,
        sid);
    end if;
  else
    perform _log(sgroup, 'match', 'deleted', 'Removed game ' || r || ' from the ' || _d(sdate) || ' session', sid);
  end if;
  return null;
end $$;

create or replace function log_tournaments() returns trigger language plpgsql security definer set search_path = public as $$
declare label text;
begin
  if tg_op = 'INSERT' then
    perform _log(new.group_id, 'tournament', 'created', 'Created tournament “' || new.name || '”');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      label := case new.status when 'in_progress' then 'started' when 'completed' then 'finished' else 'back to draft' end;
      perform _log(new.group_id, 'tournament', 'status', 'Tournament “' || new.name || '” ' || label);
    elsif new.name is distinct from old.name then
      perform _log(new.group_id, 'tournament', 'renamed', 'Renamed tournament “' || old.name || '” to “' || new.name || '”');
    end if;
  else
    perform _log(old.group_id, 'tournament', 'deleted', 'Deleted tournament “' || old.name || '”');
  end if;
  return null;
end $$;

create or replace function log_tournament_matches() returns trigger language plpgsql security definer set search_path = public as $$
declare tname text; tgroup uuid;
begin
  -- only when a score was entered or changed (the bracket also updates rows to move winners along)
  if tg_op <> 'UPDATE' then return null; end if;
  if new.score_1 is not distinct from old.score_1 and new.score_2 is not distinct from old.score_2 then return null; end if;
  select name, group_id into tname, tgroup from tournaments where id = new.tournament_id;
  if tname is null then return null; end if;
  perform _log(tgroup, 'tournament', 'score',
    case when new.score_1 is null and new.score_2 is null then 'Cleared a score in tournament “' || tname || '”'
         else 'Recorded a score in tournament “' || tname || '” (' || coalesce(new.score_1::text, '–') || '–' || coalesce(new.score_2::text, '–') || ')' end);
  return null;
end $$;

create or replace function log_group_venues() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform _log(new.group_id, 'venue', 'created', 'Added venue ' || new.name);
  elsif tg_op = 'DELETE' then
    perform _log(old.group_id, 'venue', 'deleted', 'Removed venue ' || old.name);
  end if;
  return null;
end $$;

create or replace function log_app_settings() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then return null; end if;
  if new.key = 'app_icon' then
    perform _log(null, 'setting', 'updated', 'Changed the app icon to ' || new.value);
  end if;
  return null;
end $$;

create or replace function log_group_admins() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then return null; end if;   -- e.g. the whole group is being deleted
  perform _log(new.group_id, 'setting', case tg_op when 'INSERT' then 'created' else 'updated' end,
    case tg_op when 'INSERT' then 'Set the admin passcode' else 'Changed the admin passcode' end);
  return null;
end $$;

-- ---------- attach the triggers (skipping any table that doesn't exist yet) ----------

do $$
declare t record;
begin
  for t in
    select * from (values
      ('sessions', 'log_sessions'),
      ('session_participants', 'log_participants'),
      ('members', 'log_members'),
      ('matches', 'log_matches'),
      ('tournaments', 'log_tournaments'),
      ('tournament_matches', 'log_tournament_matches'),
      ('group_venues', 'log_group_venues'),
      ('app_settings', 'log_app_settings'),
      ('group_admins', 'log_group_admins')
    ) as v(tbl, fn)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists trg_activity_log on %I', t.tbl);
      execute format('create trigger trg_activity_log after insert or update or delete on %I for each row execute function %I()', t.tbl, t.fn);
    end if;
  end loop;
end $$;

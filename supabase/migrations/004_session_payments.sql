-- 004: session payments + admin passcode.
-- Run in Supabase -> SQL Editor AFTER 003. Safe to run more than once.
--
-- How it's protected (there is no login yet):
--  * The passcode is stored hashed in `group_admins`, a table the public API cannot read.
--  * Price and payment columns can't be written directly from the app; they only change
--    through the functions below, which check the passcode inside the database.
--  * Members may mark themselves "paid, waiting approval" (or undo that). Only a valid
--    admin passcode can approve, un-approve, or set the session cost.

create extension if not exists pgcrypto with schema extensions;

-- ---------- columns ----------
alter table sessions
  add column if not exists total_cost numeric(10, 2) check (total_cost is null or total_cost >= 0);

alter table session_participants
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'approved')),
  add column if not exists paid_at timestamptz,
  add column if not exists approved_at timestamptz;

-- ---------- admin passcode (hashed, not readable from the app) ----------
create table if not exists group_admins (
  group_id uuid primary key references groups(id) on delete cascade,
  passcode_hash text not null,
  updated_at timestamptz not null default now()
);
alter table group_admins enable row level security; -- no policies = no direct access
revoke all on group_admins from anon, authenticated;

-- ---------- lock down direct writes to the protected columns ----------
revoke insert, update on sessions from anon, authenticated;
grant insert (group_id, title, date, start_time, end_time, location, courts, notes)
  on sessions to anon, authenticated;
grant update (title, date, start_time, end_time, location, courts, notes)
  on sessions to anon, authenticated;

revoke insert, update on session_participants from anon, authenticated;
grant insert (session_id, member_id) on session_participants to anon, authenticated;

-- ---------- functions ----------
create or replace function _is_group_admin(p_group uuid, p_code text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from group_admins
    where group_id = p_group and p_code is not null
      and passcode_hash = crypt(p_code, passcode_hash)
  );
$$;
revoke all on function _is_group_admin(uuid, text) from public, anon, authenticated;

create or replace function has_admin_passcode(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_admins where group_id = p_group);
$$;

create or replace function check_admin_passcode(p_group uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  perform pg_sleep(0.5); -- slows down guessing
  return _is_group_admin(p_group, p_code);
end $$;

-- First time: anyone can set it. Afterwards the current passcode is required.
create or replace function set_admin_passcode(p_group uuid, p_new text, p_current text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_new is null or length(btrim(p_new)) < 4 then
    raise exception 'Passcode must be at least 4 characters';
  end if;
  if exists (select 1 from group_admins where group_id = p_group)
     and not _is_group_admin(p_group, p_current) then
    raise exception 'Current passcode is wrong';
  end if;
  insert into group_admins (group_id, passcode_hash)
  values (p_group, crypt(p_new, gen_salt('bf')))
  on conflict (group_id) do update
    set passcode_hash = excluded.passcode_hash, updated_at = now();
end $$;

create or replace function set_session_cost(p_session uuid, p_cost numeric, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare g uuid;
begin
  select group_id into g from sessions where id = p_session;
  if g is null then raise exception 'Session not found'; end if;
  if not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Admin passcode is wrong';
  end if;
  update sessions set total_cost = p_cost where id = p_session;
end $$;

create or replace function set_payment_status(p_participant uuid, p_status text, p_code text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare cur text; g uuid; cost numeric;
begin
  if p_status not in ('unpaid', 'pending', 'approved') then
    raise exception 'Unknown payment status';
  end if;
  select sp.payment_status, s.group_id, s.total_cost into cur, g, cost
  from session_participants sp join sessions s on s.id = sp.session_id
  where sp.id = p_participant;
  if g is null then raise exception 'Participant not found'; end if;

  if cost is null and p_status <> 'unpaid' then
    raise exception 'The admin has not set the cost for this session yet';
  end if;

  -- approving, or changing an approved payment, needs the admin
  if (p_status = 'approved' or cur = 'approved') and not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Only the admin can approve payments';
  end if;

  update session_participants set
    payment_status = p_status,
    paid_at = case when p_status = 'unpaid' then null else coalesce(paid_at, now()) end,
    approved_at = case when p_status = 'approved' then now() else null end
  where id = p_participant;
end $$;

-- Admin bulk action on one session: move every participant in status `p_from` to `p_to`
-- (e.g. approve all waiting, or reset all approved back to waiting). Returns rows changed.
create or replace function bulk_set_payment_status(p_session uuid, p_from text, p_to text, p_code text)
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare g uuid; cost numeric; n integer;
begin
  if p_from not in ('unpaid', 'pending', 'approved') or p_to not in ('unpaid', 'pending', 'approved') then
    raise exception 'Unknown payment status';
  end if;
  select group_id, total_cost into g, cost from sessions where id = p_session;
  if g is null then raise exception 'Session not found'; end if;
  if not _is_group_admin(g, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Admin passcode is wrong';
  end if;
  if cost is null and p_to <> 'unpaid' then
    raise exception 'Set the cost for this session first';
  end if;

  update session_participants set
    payment_status = p_to,
    paid_at = case when p_to = 'unpaid' then null else coalesce(paid_at, now()) end,
    approved_at = case when p_to = 'approved' then now() else null end
  where session_id = p_session and payment_status = p_from;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function has_admin_passcode(uuid),
  bulk_set_payment_status(uuid, text, text, text),
  check_admin_passcode(uuid, text),
  set_admin_passcode(uuid, text, text),
  set_session_cost(uuid, numeric, text),
  set_payment_status(uuid, text, text)
  to anon, authenticated;

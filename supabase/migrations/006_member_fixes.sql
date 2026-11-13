-- 006: one-off data fixes for members.
--   1. Theo's sessions before 23 Sep 2026 (exclusive) belong to Theo Budi
--   2. Nat and Natalie are the same person: merge into Natalie
-- Run in Supabase -> SQL Editor. Safe to run more than once (a second run changes nothing).
-- Works with or without 005_chat_import.sql. Not undoable: export/back up first if unsure.
-- The last query shows the result: every number should be 0.

begin;

-- ============ 1. Theo -> Theo Budi (sessions before 2026-09-23) ============
create temp table _theo on commit drop as
select a.id as from_id, b.id as to_id
from members a join members b on b.group_id = a.group_id
where lower(a.name) = 'theo'
  and lower(b.name) in ('theodore budi', 'theo budi');

-- sessions where Theo Budi is already listed too: just drop the extra "Theo" row
delete from session_participants sp
using sessions s, _theo t
where s.id = sp.session_id
  and sp.member_id = t.from_id
  and s.date < '2026-09-23'
  and exists (select 1 from session_participants x
              where x.session_id = sp.session_id and x.member_id = t.to_id);

-- everywhere else: switch to Theo Budi (payment status is kept)
update session_participants sp
set member_id = t.to_id
from sessions s, _theo t
where s.id = sp.session_id
  and sp.member_id = t.from_id
  and s.date < '2026-09-23';

-- ============ 2. Merge Nat into Natalie ============
create temp table _nat on commit drop as
select a.id as from_id, b.id as to_id
from members a join members b on b.group_id = a.group_id
where lower(a.name) = 'nat' and lower(b.name) = 'natalie';

-- in a session with both: keep the furthest payment status on Natalie's row
update session_participants keep
set payment_status = dup.payment_status, paid_at = dup.paid_at, approved_at = dup.approved_at
from _nat m, session_participants dup
where keep.member_id = m.to_id and dup.member_id = m.from_id
  and dup.session_id = keep.session_id
  and (case dup.payment_status when 'approved' then 2 when 'pending' then 1 else 0 end)
    > (case keep.payment_status when 'approved' then 2 when 'pending' then 1 else 0 end);

delete from session_participants dup
using _nat m
where dup.member_id = m.from_id
  and exists (select 1 from session_participants k
              where k.session_id = dup.session_id and k.member_id = m.to_id);

-- all remaining Nat sessions move to Natalie
update session_participants set member_id = m.to_id
from _nat m where member_id = m.from_id;

-- Chat history page: point saved matches at Natalie (only if 005 was run)
do $$
begin
  if to_regclass('public.chat_name_map') is not null then
    update chat_name_map set
      target = replace(target::text, m.from_id::text, m.to_id::text)::jsonb,
      before_target = replace(before_target::text, m.from_id::text, m.to_id::text)::jsonb
    from _nat m
    where target::text like '%' || m.from_id || '%' or before_target::text like '%' || m.from_id || '%';

    update chat_links set overrides = replace(overrides::text, m.from_id::text, m.to_id::text)::jsonb
    from _nat m where overrides::text like '%' || m.from_id || '%';
  end if;
end $$;

-- finally remove the duplicate member
delete from members using _nat m where members.id = m.from_id;

commit;

-- ============ Result check: all should be 0 ============
select
  (select count(*) from session_participants sp
     join sessions s on s.id = sp.session_id
     join members m on m.id = sp.member_id
   where lower(m.name) = 'theo' and s.date < '2026-09-23'
     and exists (select 1 from members b where b.group_id = m.group_id
                 and lower(b.name) in ('theodore budi', 'theo budi'))) as theo_sessions_left_before_23_sep,
  (select count(*) from members m
   where lower(m.name) = 'nat'
     and exists (select 1 from members b where b.group_id = m.group_id and lower(b.name) = 'natalie')) as nat_members_left;

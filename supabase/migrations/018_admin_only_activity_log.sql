-- 018: only the admin can read the activity log.
-- Run in Supabase -> SQL Editor, AFTER 017 (and 004 for the admin passcode). Safe to run more than once.
--
-- 017 let everyone read activity_log. Now direct reads are switched off, and the only way to read it is
-- get_activity(), which checks the group's admin passcode inside the database, the same way costs,
-- approvals and deletes are protected. (The log is still written by the same triggers as before.)

drop policy if exists "Anyone can read activity_log" on activity_log;
revoke select on activity_log from anon, authenticated;

create or replace function get_activity(
  p_group uuid,
  p_code text,
  p_limit integer default 50,
  p_entities text[] default null,        -- only these kinds of change
  p_actor uuid default null,             -- only changes made by this member...
  p_actor_none boolean default false,    -- ...or only changes made by "Someone"
  p_session uuid default null,           -- only this session
  p_member uuid default null             -- only done by or about this member
) returns setof activity_log language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _is_group_admin(p_group, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Only the admin can see the activity log';
  end if;
  return query
    select * from activity_log a
    where (a.group_id = p_group or a.group_id is null)   -- settings changes belong to no group
      and (p_entities is null or a.entity = any (p_entities))
      and (p_actor is null or a.actor_member_id = p_actor)
      and (not p_actor_none or a.actor_member_id is null)
      and (p_session is null or a.session_id = p_session)
      and (p_member is null or a.member_id = p_member or a.actor_member_id = p_member)
    order by a.at desc, a.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

grant execute on function get_activity(uuid, text, integer, text[], uuid, boolean, uuid, uuid) to anon, authenticated;

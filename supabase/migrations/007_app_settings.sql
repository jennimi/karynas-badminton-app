-- 007: app-wide settings. Today it only stores which Rally icon the app uses.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- Everyone can READ settings. Nobody can write them directly: the only way to change
-- the icon is set_app_icon(), which checks the group's admin passcode (from 004) inside the database.

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
drop policy if exists "Anyone can read app_settings" on app_settings;
create policy "Anyone can read app_settings" on app_settings for select using (true);
revoke insert, update, delete on app_settings from anon, authenticated;

create or replace function set_app_icon(p_group uuid, p_icon text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_icon is null or p_icon !~ '^rally-[0-9]{2}$' then
    raise exception 'Unknown icon';
  end if;
  if not _is_group_admin(p_group, p_code) then
    perform pg_sleep(0.5);
    raise exception 'Admin passcode is wrong';
  end if;
  insert into app_settings (key, value) values ('app_icon', p_icon)
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

grant execute on function set_app_icon(uuid, text, text) to anon, authenticated;

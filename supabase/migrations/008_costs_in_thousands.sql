-- 008: session costs are now stored in THOUSANDS of Rupiah.
--      206000 -> 206   (and from now on you type 206 for Rp 206.000)
-- Run in Supabase -> SQL Editor, AFTER 007. Runs the conversion only ONCE: it leaves a marker
-- in app_settings, so running the file again changes nothing (it would otherwise divide again).
-- Not undoable by itself: to undo, multiply the costs by 1000 again.
--
-- Deploy/restart the app together with this: the app now treats the number as thousands, so until
-- this has run, old costs would look 1000x too big (and after it, an old app would look 1000x too small).

do $$
begin
  if to_regclass('public.app_settings') is null then
    raise exception 'Run 007_app_settings.sql first (it creates the app_settings table).';
  end if;

  if exists (select 1 from app_settings where key = 'cost_unit') then
    raise notice 'Costs were already converted to thousands: nothing changed.';
    return;
  end if;

  -- Real costs in Rupiah are never below 1.000, so anything smaller is already in thousands
  -- (e.g. typed by the new app before this ran): leave those alone.
  update sessions set total_cost = round(total_cost / 1000, 2)
  where total_cost is not null and total_cost >= 1000;

  insert into app_settings (key, value) values ('cost_unit', 'thousands')
  on conflict (key) do nothing;
end $$;

-- Result check: the biggest cost should now be a small number (hundreds), and "still_in_rupiah" must be 0.
select
  count(*) filter (where total_cost is not null) as sessions_with_a_cost,
  count(*) filter (where total_cost >= 1000)     as still_in_rupiah,
  min(total_cost)                                as smallest_cost,
  max(total_cost)                                as biggest_cost,
  (select value from app_settings where key = 'cost_unit') as unit_marker
from sessions;

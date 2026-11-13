-- 002: clean existing member names and block case-insensitive duplicates.
-- Run in Supabase -> SQL Editor. Safe to run more than once.

-- STEP 1 (look first): which names are dirty, or duplicates once cleaned?
-- select group_id, lower(btrim(regexp_replace(name, '[ ​-‏⁠﻿­]', ' ', 'g'))) as key,
--        count(*) as copies, array_agg(name) as names
-- from members group by 1, 2 having count(*) > 1;

-- STEP 2: clean names (invisible chars -> removed, odd spaces -> space, collapse spaces, trim).
-- Rows that would collide with an existing clean name are left alone (see STEP 1 and merge by hand).
update members m
set name = c.cleaned
from (
  select id, group_id,
         btrim(regexp_replace(
           regexp_replace(name, '[​-‏⁠﻿­]', '', 'g'),
           '[ \s]+', ' ', 'g')) as cleaned
  from members
) c
where m.id = c.id
  and m.name <> c.cleaned
  and c.cleaned <> ''
  and not exists (
    select 1 from members o
    where o.group_id = c.group_id and o.id <> c.id and lower(o.name) = lower(c.cleaned)
  );

-- STEP 3: the database itself now refuses "karyna" when "Karyna" exists in the same group.
-- (Fails if STEP 1 still shows duplicates: merge or rename those first.)
create unique index if not exists members_group_name_ci_key
  on members (group_id, lower(name));

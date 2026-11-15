-- 014: each member can choose the background colour of their icon.
-- Run in Supabase -> SQL Editor (after 013). Safe to run more than once.
--
-- Only the four accent colours of the design system are allowed (see docs/DESIGN_SYSTEM.md).
-- Empty = automatic: the app picks one of the four from their name, the same as before.

alter table members add column if not exists color text;

alter table members drop constraint if exists members_color_known;
alter table members add constraint members_color_known
  check (color is null or color in ('brand', 'lime', 'butter', 'coral'));

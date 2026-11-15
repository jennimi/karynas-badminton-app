-- 015: anyone can delete a match again (not just the admin).
-- Run in Supabase -> SQL Editor (after 010). Safe to run more than once.
--
-- 010 made deleting matches admin-only. A match is just a game record, so this reopens
-- deleting it to everyone using the app. Deleting sessions and members stays admin-only.
-- A match's players go with it (match_players cascades on delete, see migration 009).

grant delete on matches to anon, authenticated;

-- delete_match(uuid, text) from 010 is no longer used; left in place so older clients don't error.

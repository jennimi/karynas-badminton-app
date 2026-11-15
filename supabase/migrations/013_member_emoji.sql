-- 013: each member can have their own emoji.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
--
-- It is shown as their icon in the app and next to their name in the payment message
-- people paste into the chat (once their payment is approved). Empty = the app picks
-- one for them, the same as before.

alter table members add column if not exists emoji text;

alter table members drop constraint if exists members_emoji_short;
alter table members add constraint members_emoji_short check (emoji is null or char_length(emoji) between 1 and 16);

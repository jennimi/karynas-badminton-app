-- 003: number of courts booked for a session.
-- Run in Supabase -> SQL Editor. Safe to run more than once.
alter table sessions
  add column if not exists courts smallint check (courts is null or courts between 1 and 50);

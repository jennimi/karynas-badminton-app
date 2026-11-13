-- ============================================
-- Badminton Group Management - Initial Schema
-- ============================================

-- Groups
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🏸',
  created_at timestamptz not null default now()
);

-- Members (unique name per group)
create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(group_id, name)
);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text,
  date date not null,
  start_time time,
  end_time time,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

-- Session Participants (which members attended/will attend)
create table session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(session_id, member_id)
);

-- Indexes for common queries
create index idx_members_group on members(group_id);
create index idx_sessions_group on sessions(group_id);
create index idx_sessions_date on sessions(date desc);
create index idx_session_participants_session on session_participants(session_id);
create index idx_session_participants_member on session_participants(member_id);

-- Disable RLS for now (no auth, option C)
alter table groups enable row level security;
alter table members enable row level security;
alter table sessions enable row level security;
alter table session_participants enable row level security;

-- Allow all operations for anonymous users (public access)
create policy "Allow all on groups" on groups for all using (true) with check (true);
create policy "Allow all on members" on members for all using (true) with check (true);
create policy "Allow all on sessions" on sessions for all using (true) with check (true);
create policy "Allow all on session_participants" on session_participants for all using (true) with check (true);

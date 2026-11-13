# Database Schema

## Tables

### `groups`
| Column     | Type        | Notes                      |
|------------|-------------|----------------------------|
| id         | uuid (PK)   | Auto-generated             |
| name       | text        | Group name                 |
| emoji      | text        | Default: 🏸                |
| created_at | timestamptz | Auto-generated             |

### `members`
| Column     | Type        | Notes                      |
|------------|-------------|----------------------------|
| id         | uuid (PK)   | Auto-generated             |
| group_id   | uuid (FK)   | → groups.id, cascade delete |
| name       | text        | Unique per group           |
| created_at | timestamptz | Auto-generated             |

**Constraint:** `UNIQUE(group_id, name)` — no duplicate names within a group.

### `sessions`
| Column     | Type        | Notes                      |
|------------|-------------|----------------------------|
| id         | uuid (PK)   | Auto-generated             |
| group_id   | uuid (FK)   | → groups.id, cascade delete |
| title      | text        | Optional session name      |
| date       | date        | Required                   |
| start_time | time        | Optional                   |
| end_time   | time        | Optional                   |
| location   | text        | Optional                   |
| notes      | text        | Optional                   |
| created_at | timestamptz | Auto-generated             |

### `session_participants`
| Column     | Type        | Notes                      |
|------------|-------------|----------------------------|
| id         | uuid (PK)   | Auto-generated             |
| session_id | uuid (FK)   | → sessions.id, cascade delete |
| member_id  | uuid (FK)   | → members.id, cascade delete |
| created_at | timestamptz | Auto-generated             |

**Constraint:** `UNIQUE(session_id, member_id)` — a member can only be added to a session once.

## Future Tables (Gavin)

### `matches` (matchmaking)
```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round integer not null,
  court integer,
  created_at timestamptz not null default now()
);
```

### `match_players` (matchmaking)
```sql
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  team text not null check (team in ('A', 'B')),
  score integer,
  unique(match_id, member_id)
);
```

## Migrations

Migration files are in `supabase/migrations/` and are numbered sequentially:
- `001_initial_schema.sql` — groups, members, sessions, session_participants
- `002_matchmaking.sql` — Gavin creates this for matches + match_players
- `003_tournaments.sql` — Gavin creates this for tournament tables

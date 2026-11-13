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
| courts     | smallint    | Optional, courts booked    |
| total_cost | numeric     | Set by admin only (via `set_session_cost`) |
| notes      | text        | Optional                   |
| created_at | timestamptz | Auto-generated             |

### `session_participants`
| Column     | Type        | Notes                      |
|------------|-------------|----------------------------|
| id         | uuid (PK)   | Auto-generated             |
| session_id | uuid (FK)   | → sessions.id, cascade delete |
| payment_status | text    | `unpaid` / `pending` (paid, waiting approval) / `approved`. Changed only via `set_payment_status` |
| paid_at / approved_at | timestamptz | Set by `set_payment_status` |
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
- `002_clean_member_names.sql` — cleans existing names, case-insensitive unique names per group
- `003_session_courts.sql` — adds `sessions.courts` (number of courts booked)
- `004_session_payments.sql` — session cost, payment status per participant, admin passcode + functions
- `005_matchmaking.sql` — Gavin creates this for matches + match_players
- `006_tournaments.sql` — Gavin creates this for tournament tables

## Payments & admin passcode

There is no login yet, so payments are protected inside the database (see `004_session_payments.sql`):

- The group's admin passcode is stored hashed in `group_admins`, which the app cannot read.
- The app cannot write `sessions.total_cost` or `session_participants.payment_status` directly.
  It calls these functions, which check the passcode server-side:
  - `set_payment_status(participant, status, code?)` — anyone can mark `pending`/`unpaid`;
    approving or changing an approved payment needs the admin passcode.
  - `set_session_cost(session, cost, code)` — admin only.
  - `set_admin_passcode(group, new, current?)` — first time anyone can set it; afterwards the current one is required.
  - `check_admin_passcode` / `has_admin_passcode` — used by the "Admin" button.
- Editing a session's participants only adds/removes the difference, so payment statuses are kept.

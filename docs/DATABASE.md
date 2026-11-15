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
| total_cost | numeric     | In **thousands of Rupiah** (208 = Rp 208.000). Set by admin only (via `set_session_cost`) |
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

## Matches (in a session)

Created by `009_matches.sql`. Used by `src/features/matchmaking/` (the "Matches" card on a session page).

### `matches`
| Column     | Type        | Notes                                              |
|------------|-------------|----------------------------------------------------|
| id         | uuid (PK)   | Auto-generated                                     |
| session_id | uuid (FK)   | → sessions.id, cascade delete                      |
| round      | integer     | Game number within the session (1, 2, 3…)          |
| court      | integer     | Optional court number                              |
| score_a    | integer     | Team A's score; empty until the game is finished   |
| score_b    | integer     | Team B's score                                     |
| created_at | timestamptz | Auto-generated                                     |

### `match_players`
| Column    | Type      | Notes                                   |
|-----------|-----------|-----------------------------------------|
| id        | uuid (PK) | Auto-generated                          |
| match_id  | uuid (FK) | → matches.id, cascade delete            |
| member_id | uuid (FK) | → members.id, cascade delete            |
| team      | text      | `A` or `B`. Two per team = doubles, one = singles |

**Constraint:** `UNIQUE(match_id, member_id)`. Access is open like sessions (no login yet).

### `group_venues`
| Column       | Type        | Notes                                              |
|--------------|-------------|----------------------------------------------------|
| id           | uuid (PK)   | Auto-generated                                     |
| group_id     | uuid (FK)   | → groups.id, cascade delete                        |
| name         | text        | Venue name as shown on AYO                         |
| ayo_slug     | text        | End of the venue's link: `ayo.co/v/<ayo_slug>`     |
| ayo_venue_id | integer     | AYO's own number for the venue                     |
| created_at   | timestamptz | Auto-generated                                     |

**Constraint:** `UNIQUE(group_id, ayo_venue_id)`. Access is open like sessions (no login yet).

## Migrations

Migration files are in `supabase/migrations/` and are numbered sequentially:
- `001_initial_schema.sql` — groups, members, sessions, session_participants
- `002_clean_member_names.sql` — cleans existing names, case-insensitive unique names per group
- `003_session_courts.sql` — adds `sessions.courts` (number of courts booked)
- `004_session_payments.sql` — session cost, payment status per participant, admin passcode + functions
- `005_chat_import.sql` — `chat_name_map` + `chat_links` for the Chat history page
- `006_member_fixes.sql` — one-off: Theo before 23 Sep → Theo Budi, merge Nat into Natalie
- `007_app_settings.sql` — `app_settings` (which Rally icon the app uses) + admin-only `set_app_icon()`
- `008_costs_in_thousands.sql` — one-off: `sessions.total_cost` 206000 → 206 (costs are in thousands of Rupiah from now on)
- `009_matches.sql` — `matches` + `match_players` (who played whom in a session, and the score)
- `010_admin_deletes.sql` — deleting sessions / members / matches is admin-only (`delete_session`, `delete_member`, `delete_match`), plus `create_match`
- `011_tournaments.sql` — Gavin creates this for tournament tables
- `014_member_color.sql` — `members.color`: background colour of a member's icon (one of the four accent colours)
- `013_member_emoji.sql` — `members.emoji`: a member's own icon, also used in the payment message
- `012_group_venues.sql` — `group_venues`: the AYO venues each group checks on the Courts page

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

## Chat history page

`/chat-import` shows the sessions found in the group's WhatsApp chat so past sessions and payments can be
reviewed and imported. The chat is turned into `src/features/chat-import/data/chatSessions.json` by
`npm run chat:build -- "<export>.txt"` (only extracted lists/prices/marks are stored; digit strings and links are removed,
because everything in `src/` is published with the site). Two tables keep it in sync between people:

- `chat_name_map`: who each chat nickname is, optionally "before date X it meant someone else".
- `chat_links`: which found session became which real session (`session_id`), plus per-session member changes.

## Admin-only deletes

From `010_admin_deletes.sql`, direct `DELETE` on `sessions`, `members` and `matches` is switched off for the app.
The only way to delete is through functions that check the group's admin passcode in the database:
`delete_session(session, code)`, `delete_member(member, code)`, `delete_match(match, code)`.
The buttons only show in admin mode (the "Admin" button in the sidebar / phone header). Removing someone from a session,
or editing a match, is not a delete and stays open to everyone. `create_match(...)` creates a match and its players in one step
(it replaced a delete-on-failure clean-up that is no longer allowed).

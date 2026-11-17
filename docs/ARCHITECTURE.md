# Architecture

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (Postgres + REST API)
- **Data fetching:** TanStack Query (caching, refetching)
- **Routing:** React Router v6
- **Hosting:** Vercel Free Plan (static site + one serverless function, `api/ayo.ts`)

## Project Structure

```
src/
  shared/              Shared across all features
    types.ts           TypeScript interfaces (the single source of truth)
    supabase.ts        Supabase client instance
    utils/             Utility functions (name parser, etc.)
    components/        Shared UI components (Layout, etc.)
  features/
    groups/            Group management (single group for now)
    members/           Member CRUD + bulk add
    sessions/          Session CRUD + participant management
    courts/            Court availability from AYO for the group's usual venues
    matchmaking/       Matches inside a session (who played whom, the score)
    stats/             Leaderboards, per-member stats, session standings and titles, worked out from scored matches (no tables of its own)
    wrap/              Monthly Wrap: a month of sessions + matches as story slides
    tournaments/       Gavin's tournament module
api/
  ayo.ts               Serverless function: fetches venue availability from ayo.co
supabase/
  migrations/          SQL migration files (numbered)
docs/                  Documentation
```

## Key Decisions

### Single group (for now)
The database schema supports multiple groups, but the app currently auto-creates and uses one default group. To support multiple groups later, add a group selector and pass `groupId` through routes/context.

### No authentication (for now)
RLS policies are set to allow all operations. Before going public, add Supabase Auth (email login for admins) and tighten RLS.

### "This is me" instead of login (for now)
The "Who are you?" button (sidebar / phone header) lets someone pick which member they are. It is stored in
`sessionStorage` per group (`features/members/useMe.ts`): it survives reloads and is forgotten when the tab is
closed. It is a convenience only (a link to your own page, a "You" label), never a permission: anyone can pick
anyone. Admin actions still need the passcode.

### Feature folders
Each feature has its own `api.ts` (database calls), components, and page components. Features only depend on each other through `shared/types.ts` and explicit imports from other features' `api.ts`.

### Shared contract for Gavin
Gavin's matchmaking module gets participants via `getSessionParticipants(sessionId)` from `features/sessions/api.ts`. The session detail page has a placeholder where his `MatchmakingTab` component slots in.

### Court availability comes from AYO through `/api/ayo`
The Courts page (`/courts`) checks the group's saved venues (`group_venues`) on [ayo.co](https://ayo.co).
Browsers can't call ayo.co from another site, so `api/ayo.ts` fetches it server-side: on Vercel it runs as a
serverless function, and `npm run dev` mounts the same handler (see `vite.config.ts`). It reads AYO's public
venue page data (no login, no API key); if AYO changes that data, `api/ayo.ts` is the one file to fix.
The search rules (which courts are free for the whole game, price per person) are in
`src/features/courts/availability.ts` and run in the browser, so changing time or players needs no new request.

## Database

See `supabase/migrations/001_initial_schema.sql` and `docs/DATABASE.md`.

## Adding a New Feature

1. Create a folder under `src/features/your-feature/`
2. Add `api.ts` for database calls
3. Add page components
4. Add routes in `src/App.tsx`
5. If you need new tables, create `supabase/migrations/NNN_your_feature.sql`

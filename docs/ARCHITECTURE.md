# Architecture

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (Postgres + REST API)
- **Data fetching:** TanStack Query (caching, refetching)
- **Routing:** React Router v6
- **Hosting:** Vercel Free Plan (static site)

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
    matchmaking/       Gavin's matchmaking module
    tournaments/       Gavin's tournament module
supabase/
  migrations/          SQL migration files (numbered)
docs/                  Documentation
```

## Key Decisions

### Single group (for now)
The database schema supports multiple groups, but the app currently auto-creates and uses one default group. To support multiple groups later, add a group selector and pass `groupId` through routes/context.

### No authentication (for now)
RLS policies are set to allow all operations. Before going public, add Supabase Auth (email login for admins) and tighten RLS.

### Feature folders
Each feature has its own `api.ts` (database calls), components, and page components. Features only depend on each other through `shared/types.ts` and explicit imports from other features' `api.ts`.

### Shared contract for Gavin
Gavin's matchmaking module gets participants via `getSessionParticipants(sessionId)` from `features/sessions/api.ts`. The session detail page has a placeholder where his `MatchmakingTab` component slots in.

## Database

See `supabase/migrations/001_initial_schema.sql` and `docs/DATABASE.md`.

## Adding a New Feature

1. Create a folder under `src/features/your-feature/`
2. Add `api.ts` for database calls
3. Add page components
4. Add routes in `src/App.tsx`
5. If you need new tables, create `supabase/migrations/NNN_your_feature.sql`

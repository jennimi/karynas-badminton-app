# Contributing — Gavin's Guide

## Your Modules

You own two features:
1. **Matchmaking** (`src/features/matchmaking/`) — randomize doubles teams, record scores
2. **Tournaments** (`src/features/tournaments/`) — multi-session tournament brackets

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd badminton-app

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in Supabase credentials (ask Karyna)

# Run dev server
npm run dev
```

## How to Get Session Participants

This is your main integration point. Import from the sessions API:

```typescript
import { getSessionParticipants } from '../sessions/api';

// Returns Member[] — the players in this session
const participants = await getSessionParticipants(sessionId);
```

Each `Member` has:
```typescript
{
  id: string;       // Use this to link to match_players
  group_id: string;
  name: string;
  created_at: string;
}
```

## Where Your Component Plugs In

In `SessionDetailPage.tsx`, there's a placeholder div:
```
🏸 Matchmaking tab will go here (Gavin's module)
```

Replace it with:
```tsx
import MatchmakingTab from '../matchmaking/MatchmakingTab';

// In the JSX:
<MatchmakingTab sessionId={session.id} />
```

The stub component already exists at `src/features/matchmaking/MatchmakingTab.tsx`.

## Creating Your Database Tables

1. Create a new migration file: `supabase/migrations/002_matchmaking.sql`
2. Suggested schema is in `docs/DATABASE.md`
3. Run the SQL in Supabase Dashboard → SQL Editor
4. Add corresponding TypeScript types in `src/features/matchmaking/types.ts`

## Rules

- **Don't modify** files in `src/features/sessions/` or `src/features/members/` without checking with Karyna
- **Do use** `getSessionParticipants()` — that's your contract
- **Do add** your routes in `src/App.tsx` (e.g., `/sessions/:id/matches`)
- **Do add** your types in `src/features/matchmaking/types.ts` (shared types go in `src/shared/types.ts`)
- Keep your feature folder self-contained. Use `src/shared/` for anything truly shared.

## Data Flow

```
Session created (Karyna's module)
  → Participants selected
    → getSessionParticipants(sessionId) → Member[]
      → Your matchmaking logic
        → Randomize teams
        → Save matches to DB
        → Record scores
```

## Tech Stack Reference

- **Supabase client:** `import { supabase } from '../../shared/supabase'`
- **Data fetching:** TanStack Query (`useQuery`, `useMutation`)
- **Routing:** React Router v6
- **Styling:** Tailwind CSS v4 (use utility classes)

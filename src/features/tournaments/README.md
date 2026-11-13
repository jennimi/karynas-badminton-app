# Tournaments Module

**Owner:** Gavin

This module will handle tournament formats that may span multiple sessions.

## Status: Not Started

Gavin will define the requirements and implement this independently.

## Integration Points

- Tournaments reference `sessions` and `members` from the shared schema.
- Tournament-specific tables should go in their own migration file (e.g., `003_tournaments.sql`).
- Components go in `src/features/tournaments/`.
- Routes should be added in `src/App.tsx`.

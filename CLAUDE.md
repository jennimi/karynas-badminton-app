# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Long conversations:** this project has big, multi-step sessions. When the conversation gets long (many tasks done, lots of file reads and screenshots), tell the user to run `/clear` to start fresh, and say what to carry over (this file plus `docs/` hold the lasting context).

## What this is

**Rally** (formerly "Shuttle Club") is a web app for a badminton group: groups, members, sessions (who played, which courts), a per-session payment checklist, matches and scores inside a session, tournaments, an activity log, and a one-off import of past sessions from a WhatsApp chat export. Owner: Karyna. Gavin built the matchmaking and tournaments modules. Hosted on Vercel at `rally-kba.vercel.app`; repo `jennimi/karynas-badminton-app`, work lands on `main` (Gavin uses feature branches + PRs).

Stack: React 19 + TypeScript + Vite, Tailwind CSS v4, TanStack Query, React Router, Supabase (Postgres via `supabase-js`, called straight from the browser). Detailed docs live in `docs/` (`ARCHITECTURE.md`, `DATABASE.md`, `DESIGN_SYSTEM.md`, `CONTRIBUTING-GAVIN.md`): read the relevant one before changing that area, and keep them updated (the migration list in `DATABASE.md` especially).

## Commands

```bash
npm run dev                 # Vite dev server (add `-- --host` to open it from a phone on the same Wi-Fi)
npm run build               # tsc -b && vite build  (the type-check is part of the build)
npx tsc -b                  # type-check only
npm run lint                # oxlint (React hooks rules are errors; "only-export-components" warnings are normal)
npm run chat:build -- "_chat 2.txt"   # regenerate src/features/chat-import/data/chatSessions.json from a WhatsApp export
python3 scripts/extract-brand-icons.py  # re-cut public/brand/rally-NN.png from design/Rally Shuttlecock Icon Collection.png
```

There is **no test runner**. Verify with `npx tsc -b`, `npm run lint`, `npm run build`, and by looking at the page (headless Chrome screenshots work: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=out.png --window-size=1200,900 --virtual-time-budget=5000 http://localhost:5173/...`; note headless enforces a ~500px minimum width). Needs `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy `.env.example`).

## The database is changed by hand, and security lives in it

- **Migrations** are numbered SQL files in `supabase/migrations/` that the owner pastes into the Supabase SQL Editor. Nothing runs them automatically, so **a feature can ship in code before its migration has run**. Code that depends on a new table/function must fail gracefully with a message naming the file (see `shared/utils/rpcError.ts`, `friendlyRpcError`). Use the next free number (check `ls supabase/migrations`; Gavin's branches also add numbers, so collisions happen), make the file safe to run twice, and add it to the list in `docs/DATABASE.md`.
- **No login.** RLS is "allow all", so the browser can write anything. What is protected is protected **inside Postgres**, not in React:
  - The admin passcode is hashed in `group_admins` (unreadable from the app). `SECURITY DEFINER` functions check it: `set_session_cost`, `set_payment_status` (approving needs admin; members can only tick "paid, waiting"), `bulk_set_payment_status`, `set_app_icon`, `delete_session`, `delete_member`, plus `create_match`. Direct writes to the protected columns/tables are `revoke`d from `anon`. Hiding a button in React is never enough: if something must be admin-only, revoke the direct privilege and add a checked function.
  - Admin mode in the UI is `features/payments/useAdmin.ts` (passcode kept in `sessionStorage` per group, re-checked by the DB on every action); `AdminToggle` / `PaymentPanel` unlock it. Deleting sessions/members is admin-only; matches were deliberately reopened to everyone (migration 015).
- **"Who are you?"** (`features/members/useMe.ts`, `sessionStorage` per tab) is only a label, never a permission. `shared/actor.ts` reads it and `shared/supabase.ts` sends it as the `x-rally-actor` header on every request.
- **Activity log** (`017_activity_log.sql`): triggers on the main tables write `activity_log`, reading the actor from `request.headers`. So the log is "self-declared who", and read-only from the app. When writing a trigger function, branch on `tg_op`: `OLD` does not exist on insert and `NEW` does not exist on delete (reading the wrong one raises an error and blocks the user's save). A new table only appears in the log once it is added to the trigger list at the bottom of that migration.
- **Costs are stored in thousands of Rupiah** (`sessions.total_cost`: 208 = Rp 208.000), typed and shown that way. Use `COST_UNIT` / `formatCost` from `shared/utils/format.ts`; `formatMoney` takes whole Rupiah. Don't mix the two.

## Code architecture

- `src/features/<name>/` each own their `api.ts` (all Supabase calls), components and pages; features talk to each other through `shared/types.ts` (single source of truth for row types) and by importing another feature's `api.ts`. `src/shared/` holds the design-system components (`ui/`, `components/`), `utils/`, `theme/`.
- **Routing and nav:** routes are in `src/App.tsx` (all inside `AppShell`); sidebar and phone tab bar both read **one list**, `shared/components/navItems.ts`. `desktopOnly` items stay out of the phone bar (it only fits a few). `AppShell` takes feature slots (`groupSwitcher`, `adminControl`, `profileControl`) so it stays feature-agnostic.
- **"Current group":** `features/groups/hooks.ts` (`useCurrentGroup`, remembered in `localStorage`) drives Sessions/Members/etc. Pages opening a specific record call `useSyncCurrentGroup(record.group_id)`.
- **Data fetching:** TanStack Query keys are shared across pages (`['members', groupId]`, `['sessions', groupId]`, `['session', id]`, `['matches', id]`, `['appIcon']`, `['activity', ...]`); after a mutation invalidate the affected keys. Session participants are edited by diffing (add/remove only), never delete-all-and-reinsert, so payment statuses survive.
- **Names** (`shared/utils/nameParser.ts`): everything that creates or compares member names goes through `cleanName` / `nameKey` (strips emoji, odd spaces, numbering; case/accent-insensitive). Member names are unique per group case-insensitively (migration 002).
- **Member types** (Newcomer/Guest/Hiatus/Nolep/Regular) are computed in `features/members/memberType.ts` from attendance, not stored; all thresholds are in `TYPE_RULES` there.
- **Stats, titles, Wrap** (`features/stats`, `features/wrap`) store nothing and need no migration: `stats/compute.ts` (pure functions) turns scored `matches` into per-member stats, duos, leaderboards and an Elo-style rating; `stats/titles.ts` defines the titles as data; `wrap/wrap.ts` builds a month's story slides from sessions + attendance + games (it still works for months without scores). A game only counts once both scores are set and differ; 1v1 games count for wins/losses but not partners/duos. Fairness thresholds (min games for win rate / rating / titles, min games per duo) live in `RULES` in `compute.ts`, and the Wrap's smaller monthly ones in `WRAP_MIN`. Group-wide stats share the `['games', groupId]` query, invalidated when a match is saved. Pure logic is easy to check by bundling it with `rolldown` and running it in Node.
- **Short share links:** `/s/<code>` is a session id written in 22 chars (`features/payments/shareMessage.ts`); the Share dialog builds the WhatsApp-ready payment message.
- **Chat import** (`features/chat-import`, route `/chat-import`, not in the menu, `noindex`): `parseChat.ts` turns a WhatsApp export into session drafts; `scripts/build-chat-data.ts` bakes the *extracted, redacted* result into `chatSessions.json`, which ships in the public bundle. **Never commit or bundle the raw export** (`_chat*.txt` is gitignored; it holds other people's messages and bank numbers). Name matches and links to real sessions are shared via `chat_name_map` / `chat_links` (migration 005).
- **Courts page** uses the Vercel serverless function `api/ayo.ts` (proxies venue availability from ayo.co); `vercel.json` rewrites every other path to `index.html` (SPA), without which deep links 404 on Vercel.
- **Branding:** the app icon is one of 12 PNGs in `public/brand/`; which one is a shared setting (`app_settings` table, changed on `/design-kit` with the admin passcode, cached in `localStorage` key `rallyIcon` so `index.html` can set the tab icon and splash before React loads). `RallyLogo` / `RallyLoader` in `shared/components/brand/`.

## UI rules (details in `docs/DESIGN_SYSTEM.md`)

Colours only from tokens in `src/index.css` (`bg-card`, `bg-brand-soft`, `text-ink` on bright fills; never raw hex or Tailwind palette colours); status colours carry meaning (lavender = primary, lime = approved/positive, butter = pending, coral = attention/destructive). Reuse `shared/ui` components, Lucide icons only, check light + dark theme and phone width, respect `prefers-reduced-motion`. A new shared component also goes on `/design-kit`.

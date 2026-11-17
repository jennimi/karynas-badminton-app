# Design System — "Rally"

Playful, modern, friendly. Rounded cards, pastel surfaces, strong accents,
light **and** dark themes. This file is the rule book for both developers:
**reuse what exists; don't introduce new styling conventions.**

> Status: **in use.** Every page (dashboard, group, sessions, members) uses this system.
> A live reference of all shared components is at **`/design-kit`**.

## The golden rules

1. **Colours come from tokens** (`bg-card`, `text-muted-foreground`, `bg-brand-soft`…). Never hardcode hex values or use raw Tailwind palette colours (`bg-gray-100`, `text-blue-600`) in new code.
2. **Use the shared components** in `src/shared/ui/` and `src/shared/components/`. Need a variation? Add a *variant* to the shared component (via `cva`) instead of making a lookalike.
3. **Always test both themes** (toggle in the sidebar) and a phone-width window before opening a PR.
4. **Navigation lives in one file**: `src/shared/components/navItems.ts`.
5. New shared component? Put it in `shared/`, add it to the Design kit page (`/design-kit`), and mention it in a PR description so the other person knows it exists.

## Tokens

All defined in `src/index.css`. Light values on the left, dark on the right.

### Surfaces & text
| Token (Tailwind class) | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FBF8F3` | `#15111F` | Page background |
| `card` | `#FFFFFF` | `#1F1A2F` | Cards, panels, sidebar |
| `muted` | `#F3EEE6` | `#2A2340` | Hover fills, tracks, neutral badges |
| `foreground` | `#1F1A2E` | `#F3EFFA` | Main text |
| `muted-foreground` | `#6B6580` | `#AAA3C0` | Secondary text |
| `border` | `#E9E2D6` | `#322A4A` | Borders and dividers |
| `ring` | `#6D4AE0` | `#C4B0FF` | Keyboard focus outline |
| `ink` | `#1F1A2E` | same | Text placed *on* bright accent fills |

### Accents
Each accent has three roles so text is always readable:

| Accent | `fill` (buttons, swatches) | `-soft` (pastel backgrounds) | `-strong` (text on soft/card) |
|---|---|---|---|
| **Lavender** (`brand`) | `#A78BFA` | `#EDE6FF` / dark `#2E2554` | `#6D4AE0` / dark `#C9B8FF` |
| **Lime** | `#B9E769` | `#EDF8D6` / dark `#26321A` | `#4A7410` / dark `#CDEF92` |
| **Butter** | `#FFD66B` | `#FFF3CF` / dark `#3A3014` | `#865D00` / dark `#FFE29A` |
| **Coral** | `#FF927D` | `#FFE4DE` / dark `#3F2522` | `#B03722` / dark `#FFB4A6` |

Usage: `bg-brand text-ink` (solid), `bg-lime-soft text-lime-strong` (pastel).
Never put white text on a fill colour — use `text-ink`.

**Meaning (keep consistent across modules):** lavender = primary/brand, lime = positive/approved/active,
butter = pending/waiting/schedule, coral = attention/destructive/cancelled.
Example: payment badges → Not paid = `brand`, Waiting approval = `butter`, Approved = `lime`.

### Accessibility
Contrast was computed for every pair: all body-text pairs are **≥ 4.5:1 (WCAG AA)** in both themes
(muted text 5.5:1 light / 7.0:1 dark; text on pastels 4.7–10.5:1; `ink` on fills 6.2–12.1:1).
Focus is always visible (`focus-visible` outline using `ring`). Motion is disabled for users with
`prefers-reduced-motion`. Don't rely on colour alone — pair status colours with text (badges say what they mean).

### Typography
**Nunito Sans** (variable, self-hosted via `@fontsource-variable/nunito-sans` — no Google Fonts request).
- Page title: `text-3xl font-extrabold tracking-tight`
- Section title: `text-xl font-extrabold`
- Card title: `CardTitle` (`text-base font-extrabold`)
- Body: default; secondary: `text-muted-foreground`; small meta: `text-xs`/`text-sm`

### Radii, shadow, spacing
- `rounded-card` (1.25rem): cards and panels
- `rounded-control` (0.875rem): buttons, inputs, nav links
- `rounded-2xl`: icon tiles / inner list rows; `rounded-full`: badges, avatars
- `shadow-soft`: the only card shadow
- Spacing: Tailwind's default 4px scale. Page sections `space-y-8`, grids `gap-4`/`gap-6`, card padding `p-5`.

## Components

| Component | File | Notes |
|---|---|---|
| `Button` (+ `buttonVariants` for links styled as buttons) | `shared/ui/button.tsx` | variants: `primary` (one per screen), `secondary`, `lime`, `outline`, `ghost`, `danger`; sizes `sm/md/lg/icon` |
| `Card`, `CardHeader`, `CardTitle`, `CardContent` | `shared/ui/card.tsx` | Default container for everything |
| `Badge` | `shared/ui/badge.tsx` | `neutral/brand/lime/butter/coral` |
| `Input`, `Textarea`, `Field` | `shared/ui/` | `Field` wires a visible label to its control — use it in every form |
| `Dialog` | `shared/ui/dialog.tsx` | Native `<dialog>`: focus trap + Esc + backdrop for free. Mount it only while open (`{open && <X open … />}`) if it holds a form, so the form resets |
| `ConfirmDialog` | `shared/components/ConfirmDialog.tsx` | "Are you sure?" for destructive actions — never use `window.confirm` |
| `Tabs` | `shared/ui/tabs.tsx` | Segmented control (Upcoming / Past) |
| `Avatar`, `AvatarStack` | `shared/ui/avatar.tsx` | Colour is derived from the name |
| `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | `shared/ui/table.tsx` | Scrolls horizontally on mobile |
| `Skeleton` | `shared/ui/skeleton.tsx` | Small loading placeholder inside a layout |
| `RallyLogo`, `RallyMark` | `shared/components/brand/RallyLogo.tsx` | The app icon (icon, or icon + the word Rally). `motion`: `none` / `hover` (one hop while hovered) / `loop`. Shows whichever icon is chosen (see Brand below) |
| `RallyLoader` | `shared/components/brand/RallyLoader.tsx` | Page-sized loading screen: the icon hopping over a shadow + a message. Use it when a whole page is waiting; keep `Skeleton` for small placeholders |
| `IconPicker` | `shared/components/brand/IconPicker.tsx` | Choose which of the 12 icons the app uses (on `/design-kit`, admin passcode to save) |
| `Toaster` + `toast()` | `shared/ui/sonner.tsx` | `import { toast } from 'sonner'` — success/error messages (mounted once in `AppShell`) |
| `StatCard` | `shared/components/StatCard.tsx` | Number + label + icon tile |
| `PageHeader` | `shared/components/PageHeader.tsx` | Page title + description + action buttons |
| `EmptyState` | `shared/components/EmptyState.tsx` | Emoji + message + optional action, for empty lists |
| `AppShell` | `shared/components/AppShell.tsx` | Sidebar (desktop) / top bar + bottom tabs (mobile) |
| `ThemeToggle`, `useTheme()` | `shared/components/`, `shared/theme/` | Theme saved in `localStorage`, defaults to system |
| `SessionCard` | `features/sessions/components/` | One session row; reuse anywhere sessions are listed |
| `cn()` | `shared/lib/cn.ts` | Merge class names |
| `format.ts` | `shared/utils/format.ts` | Dates/times (`formatDate`, `formatTimeRange`, `relativeDay`…) — don't write your own |

**Not built yet (add when first needed, via shadcn/ui + Radix):** `Select`, `DropdownMenu`.
Add them to `shared/ui/` in the same style and list them above.

Icons: [Lucide](https://lucide.dev) only (`import { Plus } from 'lucide-react'`). Emoji are welcome for
personality (group emoji, empty states, greetings) but never as the only carrier of meaning.

## Layout & navigation
- Desktop (≥ 1024px): fixed 256px sidebar with logo, group switcher, nav, theme toggle.
- Mobile: top bar (logo + theme toggle) and a bottom tab bar. "Coming soon" items are hidden on mobile.
- Content is centred, `max-w-5xl`, with `px-4` (mobile) / `px-8` (desktop).
- Add a page: add its route in `App.tsx` (inside the `AppShell` route), add **one** entry to `navItems.ts`.

## Pages & routes
`Dashboard (groups) → Group (info, upcoming sessions, member stats, member list) → Session → Matches (Gavin)`

| Route | Page |
|---|---|
| `/` | Dashboard — groups, headline stats, upcoming sessions |
| `/groups/:id` | Group — info (edit), member statistics, top attendance, member list |
| `/sessions`, `/sessions/new`, `/sessions/:id` | Session list (Upcoming/Past), create, detail + edit + delete |
| `/members` | Add (single / pasted list), rename, remove members |
| `/members/:id` | One member: "This is me", their emoji icon, unpaid bills, every session with payment status |
| `/courts` | Free courts at the group's usual venues, read from AYO: date strip, start time, duration, courts needed, players → price per person |
| `/activity` | Activity log: what changed and who did it (filter by type and person); also embedded on the dashboard, session and member pages |
| `/s/:code` | Compact share link: the code is a session id written in 22 characters (`features/payments/shareMessage.ts`); opens that session on its Payments tab |
| `/design-kit` | Reference of shared components |

The "current group" (used by Sessions and Members) comes from `useCurrentGroup()` in `features/groups/hooks.ts`.
Today that is the first group; changing it there will switch every page when multi-group switching arrives.

## Decisions & alternatives
- **shadcn/ui approach, not the CLI.** We follow shadcn's conventions (`cva` variants, `cn()`, CSS-variable tokens) but hand-wrote the components we need — it avoids a CLI-generated `components.json`/config and keeps the dependency list small. Radix-based pieces (Select, DropdownMenu) will be added the shadcn way when needed.
- **`Dialog` uses the native `<dialog>` element** instead of Radix — fewer dependencies, built-in focus trapping and Esc handling. Revisit only if we need something it can't do (e.g. complex nested overlays).
- **Accent token is named `brand`** (lavender), not `primary`.
- **Dark mode is class-based** (`.dark` on `<html>`), applied by a tiny inline script in `index.html` before first paint to prevent a flash.
- **Recharts** is deferred until real statistics exist; the "Top attendance" bars are plain CSS for now.

## Brand: Rally
The name comes from a badminton *rally*: the back-and-forth exchange of shots. The icon is one of 12 shuttlecock
tiles (`design/Rally Shuttlecock Icon Collection.png`), cut out by `python3 scripts/extract-brand-icons.py` into
`public/brand/rally-01.png … rally-12.png`.

**Changing the icon:** open `/design-kit`, click an icon in "Rally icon" to preview it (light + dark, as the logo,
hopping, and tiny), unlock admin, then **Use for everyone**. It's saved in the `app_settings` table (migration
`007_app_settings.sql`; only `set_app_icon()` with the admin passcode can write it) and drives the sidebar logo, the
loading screens, the browser-tab icon and the loading splash. Until one is chosen the app uses `DEFAULT_ICON`
in `shared/components/brand/rallyIcons.ts`.

**Motion:** the icon is a flat picture, so it moves with a squash-and-stretch hop (`rally.css`): on hover in the
sidebar, and looping in `RallyLoader`. Switched off for `prefers-reduced-motion`.

**Adding or replacing icons:** drop a new collection image into `design/`, adjust the grid in
`extract-brand-icons.py` if the layout differs, and add the entries to `RALLY_ICONS`.

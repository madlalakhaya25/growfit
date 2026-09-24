# Growfit FA

A grassroots football platform for player development, team management, and talent visibility. Built for South African football academies and designed for daily use by coaches, players, and parents.

---

## What it does

| Role | Core capability |
|------|----------------|
| **Coach** | Manage squads, fixtures, training and attendance; plan tactics on an interactive board; ask a squad-aware AI assistant for an XI, a match plan or advice |
| **Player** | View personal passport (position, attributes, match ratings), watch plays the coach shares, learn what their position does, follow fixtures and training |
| **Parent** | Link to a child's profile using a share code, track progress and ratings, sign documents digitally |
| **Admin** | Academy-wide player and team oversight, SAFA document compliance, analytics |

### Tactics

A pitch-diagram animation studio, built to match the depth of dedicated
tools like The Tactics App and Final Third rather than sit behind them:

- 16 formation presets from 5-a-side to 11-a-side, automatic player
  assignment by position, opponent set-up
- Switchable pitch sizes — full, half, attacking third, and training
  grids — plus a training-equipment palette (cones, markers, mannequins,
  goals, bibs, poles, ladders, hurdles) for drawing an actual Wednesday
  drill, not just a Sunday match shape
- Drawing tools (runs, passes, dribbles, freehand, zones, text) with
  undo/redo covering every board edit, including frame reordering
- Pitch overlays for thirds / half-spaces / zone 14
- A real keyframe timeline: reorder, duplicate, and insert frames, set a
  per-frame duration and easing, and scrub to any point in the animation
  to edit that pose directly
- Player spotlight — a highlight bound to a specific player's token that
  follows them through the whole animation — and per-player notes that
  reach that player's own shared view, filtered so only the notes about
  them (or their child, for a parent) are ever shown
- PNG and video export, and saved plays that can be tagged by concept,
  attached to a session or fixture, and shared to the squad with a
  recorded voice note
- **Match Film** — telestration over a real moment, not just a diagram:
  draw over a captured phone-clip frame, a photo, or a live YouTube/Vimeo
  embed, then save and share the breakdown to the squad

### AI

Thirteen AI capabilities grounded in the FIFA LTPD framework, the 4-Corner Model,
SAFA's National Development Programme and CAF youth development principles:
session planner, player insights, development plans, match and parent reports,
academy health report, tactical concept and positional-role explainers, play
describer, opponent counter-analysis, and a conversational coach assistant that
suggests an XI and writes match plans.

The assistant reads the academy's own data — real ratings, recent form, training
attendance against the 75% policy, and past results — so its advice names actual
players instead of generalising. It is explicitly constrained not to invent
players or statistics, and treats the attendance threshold as a welfare trigger
rather than a punishment.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| Mobile app | Expo (React Native) — separate workspace |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth — email + password |
| ORM / queries | Supabase JS client with full TypeScript types |
| Validation | Zod v4 |
| Deployment | Vercel (web), Expo EAS (mobile) |

---

## Repository structure

```
football_path/
├── web/                        # Next.js web application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/    # Authenticated dashboard routes
│   │   │   │   └── dashboard/
│   │   │   │       ├── admin/
│   │   │   │       ├── coach/  # Squad, fixtures, training, announcements, settings
│   │   │   │       ├── player/ # Passport, fixtures, training, announcements, settings
│   │   │   │       └── parent/ # Children overview, child detail, settings
│   │   │   ├── actions/        # Server actions (one file per domain)
│   │   │   ├── auth/           # Login, register, forgot/reset password, role picker
│   │   │   ├── api/            # API routes (auth callback)
│   │   │   └── passport/       # Public player passport (no auth required)
│   │   ├── components/         # Shared UI components
│   │   │   └── ui/             # Design system primitives (Badge, Button, Card, …)
│   │   └── lib/
│   │       ├── auth.ts         # requireUser() guard + getProfile() cached fetch
│   │       ├── supabase/       # createClient (server + browser)
│   │       ├── types.ts        # Domain types mirroring DB schema
│   │       ├── utils.ts        # cn(), formatRelativeTime(), daysFromNow()
│   │       └── validation.ts   # Zod schemas for all form inputs
│   └── ...
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql      # Complete base schema + RLS + helper functions
│       ├── 002_phase1.sql      # Email auth trigger, announcements body limit
│       ├── 003_phase2.sql      # Training tables, profile fields, relationship column
│       ├── 004–013             # Reads, attendance, realtime, records, media,
│       │                       #   multi-club, documents, indexes, development,
│       │                       #   expanded attributes
│       ├── 014_claim_backfill_academy.sql  # Link academy on passport claim
│       ├── 015_tactic_plays.sql            # Saved tactical board plays
│       ├── 016_play_links_and_tags.sql     # Concept tags, session/fixture links, sharing
│       ├── 017_play_voice_notes.sql        # Coach voice notes on plays
│       ├── 018–026                         # Player import, team coach codes, player
│       │                                   #   self-update, fixture cancellation reason,
│       │                                   #   covering index, photo consent, welfare
│       │                                   #   check-ins, parent photo delete, player erasure
│       ├── 027_access_codes.sql            # Coach/admin access-code flow fix (see below)
│       ├── 028_film_surface.sql            # Match Film surface on tactic_plays
│       └── 029_shared_play_notes_privacy.sql # Filters per-player notes on a shared play
├── src/                        # Expo mobile app source
├── docs/
│   ├── ARCHITECTURE.md         # System design and data flow
│   └── ROADMAP.md              # Feature roadmap
└── ...
```

---

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is sufficient)

### 1. Clone and install

```bash
git clone https://github.com/madlalakhaya25/football_path.git
cd football_path/web
npm install
```

### 2. Environment variables

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Apply the database schema

For a project wired up with the GitHub Action below, merging a migration to
`main` applies it automatically — nothing to do by hand. Setting that up
(once, per Supabase project) needs three repo secrets under **Settings >
Secrets and variables > Actions**:

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | Project Settings > Database |
| `SUPABASE_PROJECT_ID` | Project Settings > General (the project ref) |

With those set, `.github/workflows/db-migrations.yml` runs `supabase db push`
on every push to `main` that touches `supabase/migrations/**`, plus on
demand from the Actions tab. See `docs/MIGRATION_RUNBOOK.md` for details and
for what's currently pending.

Without that set up (or for a brand-new project before its first PR), run
each migration file in order via the Supabase SQL Editor, or from a machine
with the Supabase CLI installed and linked:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Either way, run every migration in `supabase/migrations/` in numerical
order, from `001_schema.sql` through the highest-numbered file. Each one is
idempotent, so re-running a migration is safe.

The tactics features need `015`–`017` in particular: `015` creates saved
plays, `016` adds concept tags, session/fixture links and player sharing, and
`017` adds coach voice notes. `028` adds the `surface` column Match Film
needs, and `029` is a required privacy fix — without it, a shared play's
per-player coach notes are visible to the whole squad rather than filtered
to the player (or parent) they're about.

`027_access_codes.sql` fixes the coach/admin sign-up flow: previously a
coach entering their team's join/coach code at registration could land on
an unrecoverable account (wrong role, no academy, and no way to self-heal
via `/auth/role`, which itself had no `profiles` INSERT policy to upsert
against). Apply this before onboarding any coach.

Then insert the seed academy:

```sql
INSERT INTO academies (id, name, location, province)
VALUES ('00000000-0000-0000-0000-000000000001', 'GrowFit Football Academy', 'South Africa', 'Gauteng')
ON CONFLICT (id) DO NOTHING;
```

### 4. Configure Supabase Auth

In the Supabase dashboard → **Authentication → Providers**:

- Enable **Email** provider
- Disable email confirmation (pilot mode) or configure your SMTP
- Set **Site URL** to `http://localhost:3000` (dev) or your Vercel URL (prod)
- Add `http://localhost:3000/api/auth/callback` as an allowed redirect URL

### 5. Run the dev server

```bash
cd web
npm run dev
```

App is available at `http://localhost:3000`.

---

## Deployment

The web app deploys to **Vercel** automatically on push to `main`. No additional build configuration is required — `vercel.json` and `next.config.ts` handle it.

Environment variables must be set in the Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Key architectural decisions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

- **Server Components by default** — data fetching happens on the server; only interactive forms use `"use client"`
- **Server Actions** — all mutations go through typed server actions in `app/actions/`, never client-side fetch calls
- **Row Level Security** — all data access is enforced at the database level; the app trusts RLS, not application-layer checks
- **Single academy (pilot)** — `DEFAULT_ACADEMY_ID` scopes all data to one academy; multi-tenancy is a planned extension

---

## Further reading

- [System design and architecture](docs/ARCHITECTURE.md)
- [Product roadmap](docs/ROADMAP.md)

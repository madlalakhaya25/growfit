# System Design & Architecture

## Overview

FootballPath is a full-stack web application backed by a managed PostgreSQL database. The architecture is deliberately simple: a Next.js App Router frontend talks directly to Supabase via the official JS client. There is no custom API layer — mutations go through Next.js Server Actions, reads happen in Server Components.

---

## High-level system diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (browser)                         │
│                                                                 │
│   React 19 Server Components  +  "use client" island components │
│   Tailwind CSS v4  ·  Lucide icons  ·  next-themes             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 16 APP ROUTER                        │
│                      (Vercel Edge / Node)                       │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ Server       │   │ Server       │   │ Route Handlers   │    │
│  │ Components   │   │ Actions      │   │ /api/auth/       │    │
│  │ (reads)      │   │ (mutations)  │   │ callback         │    │
│  └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘    │
│         │                  │                    │              │
└─────────┼──────────────────┼────────────────────┼─────────────┘
          │                  │                    │
          │ supabase-js (server client — httpOnly cookie session)
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
│                                                                 │
│  ┌─────────────────┐        ┌──────────────────────────────┐   │
│  │   PostgreSQL    │        │          Auth                │   │
│  │                 │        │  Email + password            │   │
│  │  12 tables      │        │  JWT in httpOnly cookie      │   │
│  │  Row Level      │        │  on_auth_user_created        │   │
│  │  Security       │        │  trigger → profiles insert   │   │
│  │                 │        └──────────────────────────────┘   │
│  │  SECURITY       │        ┌──────────────────────────────┐   │
│  │  DEFINER fns    │        │         Storage              │   │
│  │                 │        │  Player photos               │   │
│  └─────────────────┘        └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication flow

```
User submits login form
        │
        ▼
Server Action (signInWithPassword)
        │
        ├─ success → supabase sets httpOnly session cookie
        │              → fetch profile → redirect to /dashboard/:role
        │
        └─ failure → return { error } → displayed in form
```

**Registration** additionally:
1. Calls `supabase.auth.signUp()` with `raw_user_meta_data` containing `full_name` and `role`
2. Postgres trigger `handle_new_user()` fires on `auth.users` INSERT → creates the `profiles` row
3. If `role = parent` and `share_token` provided → lookups player → upserts `parent_player_links`

**Password reset** uses the standard Supabase PKCE flow:
`resetPasswordForEmail` → email link → `/auth/reset-password?code=…` → `exchangeCodeForSession` → `updateUser`

---

## Database schema

### Tables

```
academies               — academy metadata (name, location, province)
profiles                — one row per auth.users row; holds role, full_name, coaching_role, bio, phone
players                 — player records (can exist before profile link); share_token for public passport
teams                   — belongs to academy + coach
team_members            — many-to-many: players ↔ teams
parent_player_links     — many-to-many: parent profiles ↔ players + relationship label
fixtures                — scheduled matches per team
match_results           — 1:1 with fixtures; team/opponent score
match_appearances       — player presence at a fixture
player_ratings          — coach rating (1–5) per player; optionally tied to a fixture
player_attributes       — coach ability assessment (pace, shooting, …, physical) 1–99 scale; one row per (player, coach)
training_sessions       — scheduled training with type, location, notes
training_drills         — ordered drills within a session; optional video URL
announcements           — team broadcast messages from coaches
tactic_plays            — saved tactical board plays: JSONB board state (tokens,
                          drawn shapes, animation frames), concept tags, optional
                          session/fixture link, share token + shared flag for the
                          player-facing view, and an optional coach voice note
```

Board state is deliberately stored as JSONB rather than normalised columns: the
board's shape is still evolving, and a play is always read and written whole, so
there is nothing to gain from splitting tokens and frames into their own tables.

### Key invariants

- `players.share_token` is globally unique; used for public passport URLs and parent linking
- `player_ratings`: fixture-linked ratings have a `UNIQUE(fixture_id, player_id, coach_id)` partial index; standalone ratings (no fixture) are unrestricted
- `player_attributes`: one row per `(player_id, coach_id)` — upserted on every assessment
- All tables have `ENABLE ROW LEVEL SECURITY`

### AI layer

AI features are Gemini-backed server actions in `web/src/app/actions/`. They share
one squad-context builder (`squad-context.ts`) that assembles the team's real data
— players with position, form and training attendance, squad attribute averages,
recent results, and previous meetings with an upcoming opponent — into a single
text brief. That brief is passed into the prompt so advice cites real players and
real numbers.

The brief is rebuilt per request rather than cached, so answers always reflect
current data, and prompts forbid inventing players or statistics not present in it.

### Helper functions (SECURITY DEFINER)

| Function | Purpose |
|----------|---------|
| `auth_role()` | Returns calling user's role from profiles |
| `auth_academy_id()` | Returns calling user's academy_id |
| `is_admin_or_coach()` | Boolean role check |
| `get_public_passport(token)` | Bypasses RLS to serve public passport page |
| `claim_player_profile(token)` | Atomically links player record to a user |
| `log_match_result(...)` | Atomic match logging: result + status + appearances + ratings |

All SECURITY DEFINER functions include `SET search_path = public, pg_temp` to prevent search-path injection.

---

## Row Level Security model

Every table has policies enforcing that users can only see or modify data within their academy. The core pattern:

```
coach   → reads/writes data for teams they own (coach_id = auth.uid())
player  → reads their own player record (profile_id = auth.uid())
parent  → reads players linked via parent_player_links
admin   → reads/writes all data within their academy
```

No application-level authorization checks are needed — Supabase enforces it at query time. Server actions do minimal secondary checks (e.g. "does this coach own this team?") only where RLS alone cannot express the constraint cleanly.

---

## Data flow — server action mutation

```
1. User submits form (React form with action={serverAction})
2. Server Action runs on Node.js:
   a. requireUser() — validates session, returns supabase client + user
   b. Zod schema validates raw FormData
   c. Secondary authorization check (if needed)
   d. supabase.from("table").insert/update/delete
   e. revalidatePath() invalidates affected route cache
   f. Returns { error } or redirects
3. React re-renders with fresh server data
```

No `fetch()` calls, no REST endpoints, no client-side state management for server data.

---

## Rendering strategy

| Page type | Strategy | Reason |
|-----------|----------|--------|
| Dashboard pages | Server Component | Data fetched on server, no client JS overhead |
| Auth pages | `"use client"` | Need browser APIs (redirects, Supabase browser client) |
| Form components | `"use client"` with `useActionState` | Progressive enhancement, pending state |
| Delete/action buttons | `"use client"` with `useTransition` | Optimistic pending state only |
| Public passport | Server Component | Static-ish, no auth |

`getProfile()` uses `React.cache` for per-request deduplication — layout and sub-layout both call it without issuing two DB queries.

---

## Project layout — web app

```
web/src/
├── app/
│   ├── (protected)/
│   │   └── dashboard/
│   │       ├── layout.tsx          ← fetches profile, renders DashboardShell
│   │       ├── coach/
│   │       │   ├── page.tsx        ← overview + "What's Next" smart cards
│   │       │   ├── squad/          ← squad list, player detail, add player
│   │       │   ├── fixtures/       ← fixture list, new, detail, log result
│   │       │   ├── training/       ← session list, new, session detail + drills
│   │       │   ├── announcements/  ← feed + compose
│   │       │   └── settings/       ← profile form
│   │       ├── player/             ← passport, fixtures, training, announcements, settings
│   │       ├── parent/             ← children list, child detail, settings
│   │       └── admin/              ← player search, team management
│   ├── actions/                    ← server actions (one file per domain)
│   │   ├── announcements.ts
│   │   ├── attributes.ts
│   │   ├── fixtures.ts
│   │   ├── parent.ts
│   │   ├── player.ts
│   │   ├── profile.ts
│   │   ├── ratings.ts
│   │   ├── squad.ts
│   │   └── training.ts
│   ├── auth/                       ← login, register, forgot-password, reset-password, role
│   ├── api/auth/callback/          ← PKCE code exchange (password reset)
│   └── passport/[token]/           ← public player passport (no auth)
├── components/
│   ├── ui/
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── rating-ring.tsx         ← SVG circular progress for overall rating
│   │   ├── skeleton.tsx
│   │   └── stat-bar.tsx            ← horizontal attribute bar (pace, shooting, …)
│   ├── dashboard-shell.tsx         ← sidebar nav + mobile bottom nav
│   ├── create-team-form.tsx
│   ├── logo.tsx
│   └── theme-toggle.tsx
└── lib/
    ├── auth.ts                     ← requireUser(), getProfile()
    ├── constants.ts                ← DEFAULT_ACADEMY_ID
    ├── supabase/
    │   ├── client.ts               ← createBrowserClient
    │   └── server.ts               ← createServerClient (cookie-based)
    ├── types.ts                    ← UserRole, FixtureStatus, Position, domain interfaces
    ├── utils.ts                    ← cn(), formatRelativeTime(), daysFromNow()
    └── validation.ts               ← Zod schemas for all form inputs
```

---

## Design system

Built with **Tailwind CSS v4** using a single `@theme` block in `globals.css` as the source of truth for all tokens. No shadcn/ui dependency — components are written from scratch against the token set.

**Colour tokens:**
- `--color-primary` / `--color-brand` — GrowFit red (`#af2d35` light, `#d4434c` dark)
- `--color-success / warning / destructive` — status colours
- Full dark-mode overrides via `.dark {}` class (toggled by `next-themes`)

**Component primitives:** `Badge` (6 variants), `Button` (4 variants), `Card` family, `RatingRing` (SVG), `StatBar` (attribute bars)

---

## Security posture

| Concern | Mitigation |
|---------|-----------|
| Auth bypass | Supabase JWT verified server-side on every request; `requireUser()` in all server actions |
| Data leakage | Row Level Security enforced at DB level for every table |
| SQL injection | Parameterised queries via Supabase JS client only |
| XSS | React JSX escaping; no `dangerouslySetInnerHTML` |
| Clickjacking | `X-Frame-Options: DENY` header |
| MIME sniffing | `X-Content-Type-Options: nosniff` header |
| SECURITY DEFINER functions | All include `SET search_path = public, pg_temp` |

---

## Scalability notes

The current architecture is deliberately simple for a pilot. When the user base grows:

- **Multi-tenancy**: `academy_id` is already on every table; removing `DEFAULT_ACADEMY_ID` and routing users to their academy at signup is the only change needed
- **Read performance**: RLS helper functions (`auth_role()`, `auth_academy_id()`) are called frequently — add a `profiles` index on `(id, role, academy_id)` under load
- **Real-time**: Supabase Realtime can be added to announcements/fixtures feeds without schema changes (all tables already support it)
- **File storage**: Player photos use Supabase Storage with public URLs; bucket policies mirror RLS rules

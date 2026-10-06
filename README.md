# Growfit FA

A grassroots football platform for player development, team management, and talent visibility, built for **Growfit Sports Academy** (Greater Durban, an NPC) and designed so other South African academies can run on it too. Coaches, players, parents and admins each get a home screen made for the job they do that day.

---

## What it does

| Role | Core capability |
|------|----------------|
| **Coach** | Squads, fixtures, training and attendance; the tactics board; playing-time planner; term reviews; a squad-aware AI assistant |
| **Player** | A **Today** home and a **Passport** (position and role, attributes, ratings), plays and homework from the coach, skill challenges, development milestones |
| **Parent** | A **Today** home for their own child (next match or training, forms to sign, the coach's weekly note), a weekly family digest, digital document signing |
| **Admin** | **Today** home with registration health, teams to chase and welfare count; academy-wide players, teams, drills, term dates, analytics, SAFA document compliance |

Every screen shows the academy's own name and crest. Pages with several areas use URL tabs (`?tab=`), so a tab can be bookmarked or shared (`lib/tabs.ts`, `QueryTabs`).

### Safeguarding rules the code enforces

- A parent sees only their own child. A player sees only their own results, never a teammate comparison.
- Nothing AI-written reaches a child or parent until a coach has approved it.
- Video analysis of a child needs recorded consent (`ai_analysis_consent`).
- Photos are served only with photo consent; personal data is scrubbed before it reaches Sentry.

### Tactics

A pitch-diagram animation studio, built to match dedicated tools like The Tactics App and Final Third:

- A **board dock** (Players, Draw, Move, Coach AI), full-pitch formations with attack and defend shapes for both teams (including 4-3-2-1), and half-pitch for U12 and below
- **Tell the board**: type or dictate an instruction ("overlap", "underlap", "press", "shift across") and the board turns it into movement, previews it, then applies it. Gemini returns actions, not coordinates
- With and without ball shapes, a timeline scrubber, phases, play folders, and per-frame duration and easing
- Pitch sizes, training grids and an equipment palette for drawing a Wednesday drill as well as a Sunday shape
- Player spotlight and per-player notes, filtered so a player or parent only sees notes about them
- **Share**: WhatsApp-ready MP4 (720x1280, WebCodecs with a MediaRecorder fallback), a PDF handout, PNG, and plays shared to the squad with a voice note. Positions and first names only
- **Match Film**: telestration over a phone-clip frame, photo or YouTube/Vimeo embed
- Positions with roles, and age-relative attribute presets (hidden until Buhle approves the wording: `PRESETS_APPROVED` in `lib/attribute-presets.ts`)

### Training and development

- Attendance (P/A/L/E) that survives a bad connection, with the 75% threshold surfacing a welfare check-in
- Playing-time planner, tactics homework, skill challenges, a drill library (academy-wide, with diagrams), session effort and session memory
- Five milestone categories per season, term plans, and term reviews (band descriptions are coach-drafted and gated by `BAND_DESCRIPTIONS_APPROVED` in `lib/term-review.ts`)
- Player self-assessments and coach notes (only approved notes reach families)

### AI

Gemini only, grounded in FIFA LTPD, the 4-Corner Model, SAFA NDP and CAF youth principles. It covers the session planner, player insights, development plans, match and parent reports, the academy health report, tactical explainers, opponent analysis, board instructions, drill diagrams, weekly family digest and a conversational coach assistant that suggests an XI and writes match plans.

It reads the academy's own data (ratings, form, attendance against the 75% policy, results) so advice names real players, and it is constrained not to invent players or statistics. Results are stored (`ai_artefacts`), cached, rate limited, and retried with an optional fallback model (`GEMINI_MODEL_FALLBACK`). AI use is tracked per month on the admin analytics page.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Web frontend | Next.js 16 (App Router, async `searchParams`), React 19, Tailwind CSS v4 |
| Mobile app | Expo (React Native) shell in the repo root; scaffolded early, not under active development |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth, email + password |
| AI | Google Gemini via `@google/genai` |
| Documents and media | `pdf-lib` (handouts, cards), `mediabunny` (MP4 export) |
| Validation | Zod v4 |
| Errors | Sentry (`@sentry/nextjs`, EU region) |
| Tests | Jest (unit), Playwright (smoke) |
| Deployment | Vercel (web, **main branch only**), Expo EAS (mobile, unused so far) |

---

## Repository structure

```
growfit/
├── web/                        # Next.js web application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/dashboard/
│   │   │   │   ├── admin/      # Today, players, teams, drills, development, analytics, academy
│   │   │   │   ├── coach/      # Squad, fixtures, training, tactics, assistant, welfare, settings
│   │   │   │   ├── player/     # Today + Passport tabs, development, homework, challenges, tactics
│   │   │   │   └── parent/     # Today, child detail, fixtures, announcements, settings
│   │   │   ├── actions/        # Server Actions, one file per domain
│   │   │   ├── auth/           # Login, register, password reset, role picker
│   │   │   └── passport/       # Public player passport (no auth)
│   │   ├── components/         # Shared UI (ui/ holds the design primitives)
│   │   └── lib/                # Pure helpers with tests in lib/__tests__
│   │       ├── *-data.ts       # Loaders that read through the user's own session, so RLS applies
│   │       ├── board-*.ts      # Tactics board model, instructions, timeline, video, render
│   │       ├── ai-*.ts         # Gemini guard, cache, retry, safeguards, artefacts
│   │       ├── tabs.ts         # URL tabs
│   │       └── supabase/       # Server and browser clients
├── supabase/migrations/        # 001 to 066 (046 and 047 were never used)
├── site/                       # Public marketing site
├── App.tsx, src/, app/         # Expo mobile shell (not under active development)
└── docs/                       # See Further reading
```

---

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is enough)
- A Gemini API key for the AI features

### 1. Clone and install

```bash
git clone https://github.com/madlalakhaya25/growfit.git
cd growfit/web
npm install
```

### 2. Environment variables

Copy `web/.env.example` to `web/.env.local`.

| Variable | Needed | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase project |
| `NEXT_PUBLIC_SITE_URL` | Yes | Absolute links for shared passports and plays |
| `GEMINI_API_KEY` | For AI | Every AI feature |
| `GEMINI_MODEL`, `GEMINI_MODEL_DOC`, `GEMINI_MODEL_LITE`, `GEMINI_MODEL_FALLBACK` | Optional | Override model ids (defaults in `src/lib/ai-models.ts`) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional | Error reporting |
| `SENTRY_AUTH_TOKEN` | Optional | Readable production stack traces |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional | Shared rate limiting (falls back to in-memory) |

### 3. Apply the database schema

Run every file in `supabase/migrations/` in numerical order, `001_schema.sql` through `066_player_positions.sql`, in the Supabase SQL Editor (or `supabase db push`). Migrations are idempotent. The app tolerates a missing table or column, so a feature simply stays empty until its migration has run.

Migrations `030` onward are described, with verification queries, in [`docs/MIGRATION_RUNBOOK.md`](docs/MIGRATION_RUNBOOK.md). Run any migration that changes policies or data on production deliberately, not as part of a deploy.

Then insert a seed academy (or register one at `/register-club`):

```sql
INSERT INTO academies (id, name, location, province)
VALUES ('00000000-0000-0000-0000-000000000001', 'Growfit Sports Academy', 'Greater Durban', 'KwaZulu-Natal')
ON CONFLICT (id) DO NOTHING;
```

`supabase/seed.sql` seeds a fuller test project.

### 4. Configure Supabase Auth

In **Authentication → Providers**: enable Email, disable confirmation for a pilot (or configure SMTP), set **Site URL** to `http://localhost:3000`, and allow `http://localhost:3000/api/auth/callback` as a redirect URL.

### 5. Run it

```bash
cd web
npm run dev        # http://localhost:3000
npm test           # Jest
npm run test:e2e   # Playwright smoke tests
npm run build
```

---

## Deployment

The web app deploys to **Vercel** from `main` only. `web/vercel.json` sets an `ignoreCommand` so every other branch is skipped, which means pull requests get **no preview URL**; verify visuals locally. Set the environment variables above in the Vercel project settings.

CI (`.github/workflows/pr-checks.yml`) runs tests and the build on every pull request, alongside CodeQL, SonarCloud and GitGuardian. Commit messages must not carry AI co-author trailers.

---

## Key architectural decisions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

- **Server Components by default**: data is fetched on the server; `"use client"` is for interactive pieces
- **Server Actions**: all mutations go through typed actions in `app/actions/`. A `"use server"` file exports only async functions, and a test guards that
- **Row Level Security**: access is enforced in the database. `*-data.ts` loaders use the user's own session so a query can only return what that user may see
- **Pure logic in `lib/`**: rules (attendance, playing time, board instructions, Today homes) are plain functions with unit tests, separate from the loaders that fetch data
- **Multi-academy**: every row is scoped to an academy; each academy has its own name, crest, terms and drill library
- **AI is reviewed, not trusted**: structured output, safeguards and a coach approval step before anything reaches a child or parent

---

## Further reading

- [System design and architecture](docs/ARCHITECTURE.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Product strategy](docs/PRODUCT_STRATEGY.md), its [research](docs/research/) and [feature specs](docs/FEATURE_SPECS/)
- [Product roadmap](docs/ROADMAP.md) and [outstanding work](docs/BACKLOG.md)
- [AI and UX plan](docs/AI_AND_UX_PLAN_2026.md)
- [Migration runbook](docs/MIGRATION_RUNBOOK.md)

# System Design & Architecture

*Last updated 2026-09-16. Updated this pass for the access-code flow fix
(migration 027) and the tactics studio's expansion into a full pitch-diagram
animation tool — pitch sizes/training equipment, a real keyframe timeline,
player spotlight/per-player notes, and a second "Match Film" surface for
telestrating over video/photos/embeds. Previous rewrite (2026-09-06) moved
this off the app's original working name ("FootballPath") and a 12-table
schema with no AI, tactics, PDF, or testing layers described at all.*

## Overview

**Growfit FA** is a full-stack web application for a real grassroots football
academy, backed by a managed PostgreSQL database. The architecture is
deliberately simple: a Next.js App Router frontend talks directly to Supabase
via the official JS client. There is no custom API layer for the app's own
data — mutations go through Next.js Server Actions, reads happen in Server
Components. The only REST-style routes are a handful of `route.ts` handlers
for things that don't fit that shape: CSV/PDF report downloads, the SAFA card
PDF generator, and the print-friendly document view.

This repository holds three separate workspaces:

| Workspace | What it is | Status |
|---|---|---|
| `web/` | The product — Next.js 16 + Supabase. Everything below describes this. | Actively developed |
| `site/` | A standalone Next.js marketing site (added 2026-06-22) | Separate, not covered here |
| repo root (`App.tsx`, `app.json`, …) | An Expo/React Native mobile shell, still under the old "footballpath" package name | Scaffolded early on; not under active development — the web app is where real feature work happens |

---

## High-level system diagram

```
┌──────────────────────────────────────────────────────────────┐
│ CLIENT (browser)                                             │
│                                                              │
│ React 19 Server Components + "use client" islands            │
│ Tailwind CSS v4 · Lucide icons · next-themes                 │
│ Service worker: PWA, offline fallback, install prompt        │
└──────────────────────────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ NEXT.JS 16 APP ROUTER                                        │
│                                                              │
│ src/proxy.ts — global auth guard + auth-route rate limit     │
│ (this is Next 16's renamed middleware.ts, exporting a        │
│ `proxy` function, not `middleware`)                          │
│                                                              │
│ Server Components (reads)                                    │
│ Server Actions (mutations)                                   │
│ Route Handlers — /api/reports/*, /api/players/:id/card,      │
│                  /api/passport/:token                        │
└──────────────────────────────────────────────────────────────┘
                           │ supabase-js (server client, httpOnly cookie session)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ SUPABASE                                                     │
│                                                              │
│ PostgreSQL — 29 tables, Row Level Security on every one,     │
│              SECURITY DEFINER helper functions               │
│ Auth        — email + password, JWT in httpOnly cookie,      │
│               handle_new_user() trigger → profiles insert    │
│ Storage     — player-photos bucket, public URLs              │
└──────────────────────────────────────────────────────────────┘
                           │ generateContent()
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ GOOGLE GEMINI (@google/genai)                                │
│                                                              │
│ 13 server actions across 8 files — see "AI layer" below      │
│ Model id centralised in src/lib/ai-models.ts                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Authentication & authorisation flow

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

Every request also passes through `src/proxy.ts` first — the global route
guard (this is Next.js 16's renamed `middleware.ts`; it exports a `proxy`
function, not `middleware`). It checks the session cookie and redirects an
unauthenticated visitor away from anything not in its `PUBLIC_PATHS`
allowlist, and rate-limits the auth routes themselves (10 requests/min/IP,
in-memory — noted in the file as needing a shared store like Upstash Redis
once there's more than one server instance). This check degrades gracefully
even if Supabase is unreachable or misconfigured — `getUser()` returns
`{ user: null }` rather than throwing, so the guard fails closed (redirects
to login) instead of crashing. The `(protected)` layout (`getProfile()`)
performs a second, more specific check: no role → `/auth/role`; a role other
than player with no academy → also `/auth/role`.

**Registration:**
1. `supabase.auth.signUp()` with `raw_user_meta_data` containing `full_name`
   and `role`
2. `handle_new_user()` Postgres trigger fires on `auth.users` INSERT →
   creates the `profiles` row
3. A new academy can be created at signup via `/register-club`; every real
   signup path resolves its own `academy_id`. The original single-tenant
   pilot's `DEFAULT_ACADEMY_ID` constant (`src/lib/constants.ts`) has been
   deleted — it had no importers left anywhere
4. A coach joining an *existing* team uses a team join/coach code
   (`team_coaches`, migration 019) rather than a club-wide code
5. If `role = parent` with a `share_token` → looks up the player → upserts
   `parent_player_links`

**Access-code redemption (migration 027)**: three lookalike 6-character
codes exist — an academy join code, a team coach code, and a team player
invite code — and a human can't tell them apart on sight. Redemption now
goes through one SECURITY DEFINER RPC, `redeem_access_code(p_code, p_role,
p_expect_kind)`, which looks the code up across all three tables, confirms
the caller-supplied `p_expect_kind` before making any write (closing a hole
where a player invite code silently worked as a coach-role assignment), and
refuses `p_role = 'coach'` on the academy-code branch entirely — a coach
seat is only ever granted by a *team* coach code, never a club-wide one.
`handle_new_user()` only honours `role ∈ {player, parent}` from signup
metadata; `coach`/`admin` can never be self-assigned through the trigger.
A code is validated with `peek_access_code()` *before* `signUp()` runs, so
a mistyped or wrong-kind code no longer creates an orphaned, unrecoverable
account. `profiles` gained an INSERT policy (`profile_insert_own`) and a
`WITH CHECK` on its UPDATE policy restricting which columns a user can
self-edit — closing both "the recovery screen's upsert always failed with
a raw RLS error" and "any authenticated user could PATCH their own role to
admin."

**Password reset** uses the standard Supabase PKCE flow:
`resetPasswordForEmail` → email link → `/auth/reset-password?code=…` →
`exchangeCodeForSession` → `updateUser`.

---

## Database schema

29 tables, all with Row Level Security enabled. Grouped by domain rather than
alphabetically:

```
Identity & academy
  academies                       — academy metadata
  profiles                        — one row per auth.users row: role, full_name, coaching_role, bio, phone

Players & squads
  players                         — player record; can exist before a profile is linked; share_token for the public passport
  teams                           — belongs to an academy
  team_coaches                    — many-to-many: multiple coaches per team (migration 019)
  team_members                    — many-to-many: players ↔ teams
  parent_player_links             — many-to-many: parent profiles ↔ players, with a relationship label
  player_attributes               — 25 columns (6 core + 19 position-specific, e.g. tackling, first_touch,
                                     shot_stopping), 1–99 scale, one row per (player, coach)
  player_ratings                  — coach rating 1–5, optionally tied to a fixture
  player_clips                    — video clip links tagged to a player

Fixtures & attendance
  fixtures                        — scheduled matches; status enum (upcoming/completed/cancelled/postponed)
                                     plus cancellation_reason (021) — see the fixtures gotcha below
  match_results                   — 1:1 with fixtures; team/opponent score
  match_appearances               — player presence at a fixture
  match_attendance                — a player's own "attending / unavailable" self-report for a fixture
  training_sessions               — scheduled training: type, location, notes
  training_drills                 — ordered drills within a session, optional video URL
  training_attendance             — coach-marked P/A/L/E per player per session (migration 005)
  drill_library                   — a reusable drill catalogue, independent of any one session
  welfare_checkins                — logged record that a coach followed up on a player below the
                                     75% attendance threshold (migration 024) — a log, not a dismiss flag

Development & records
  development_milestone_templates — the 5-category milestone framework (Technical, Tactical, Physical,
                                     Mental, Leadership) an admin configures per age group
  player_milestone_completions    — which milestones a player has hit
  player_documents                — status per (player, document_type, season) across 6 required documents
  player_consents                 — POPIA / photo / transport / risk-acknowledgement checkboxes
  player_medical                  — medical & emergency contact details

Media & communication
  media_uploads / media_tags      — photos/videos attached to a fixture or session, tagged to players
  announcements / announcement_reads — team broadcasts + per-reader read state

Tactics
  tactic_plays                    — JSONB board state (tokens, drawn shapes, animation frames, placed
                                     equipment, per-player notes, pitch/surface choice), concept tags,
                                     optional session/fixture link, share token for the player-facing
                                     view, optional coach voice note
```

Board state is deliberately stored as JSONB rather than normalised columns —
the board's shape is still evolving and a play is always read/written whole,
so there's nothing to gain from splitting tokens and frames into their own
tables.

### Key invariants

- `players.share_token` is globally unique, and is a **public identifier, not
  a credential**. Nothing may grant access on the strength of it alone. It is
  the public passport URL segment and is printed on every PDF player card, so
  treat it as known to anyone. This was previously listed here as an invariant
  that "public passport URLs and parent linking both key off it" — that double
  duty was the vulnerability migration 032 closes; parent linking now requires
  a staff-issued, single-use code
- `player_ratings`: fixture-linked ratings have a
  `UNIQUE(fixture_id, player_id, coach_id)` partial index; standalone ratings
  are unrestricted
- `player_attributes`: one row per `(player_id, coach_id)`, upserted on every
  assessment
- **`fixtures.status` is not the same thing as "has this match happened
  yet."** It only moves to `completed` when a coach manually logs the
  result — a match that kicked off yesterday can sit at `upcoming` for days.
  `src/lib/fixtures.ts`'s `isFixturePast()` is the actual source of truth
  everywhere the UI needs to know: past once kickoff has elapsed *or* once
  logged completed/cancelled, whichever comes first (`postponed` is the one
  exception — it stays "upcoming" until rescheduled, since its stored date
  is stale by definition). Never trust the raw column for a date-based
  question again without going through that function.
- **Age and initials were each computed independently in ~12 files.**
  Not a data-access duplication (the query differed by page) but a
  *decision* duplication — the same judgment call re-made from scratch each
  time, with no guarantee the copies agreed. `src/lib/player.ts`
  (`calculateAge`, `getInitials`) is now the one place either is decided;
  every call site imports it rather than re-deriving. Same category of fix
  as `isFixturePast` above and the headshot matching below — when a rule
  about the data (not just a fetch of it) shows up a second time, pull it
  into a function before a third copy can quietly drift from the other two.

### Helper functions (SECURITY DEFINER)

| Function | Purpose |
|---|---|
| `auth_role()` | Returns the calling user's role from `profiles` |
| `auth_academy_id()` | Returns the calling user's `academy_id` |
| `is_admin_or_coach()` | Boolean role check |
| `get_public_passport(token)` | Bypasses RLS to serve the public passport page; enforces photo consent (023) — nulls `photo_url` unless `photo_consent` is true for the current season, inside the function itself so it can't be skipped by a future caller. Since 032 it returns a derived integer `age` rather than raw `date_of_birth`, omits the coach's free-text rating notes and the internal player UUID, and returns `NULL` (not an error object) for an unknown token |
| `redeem_parent_link_code(code)` | The only way a parent may attach themselves to a child (032). Single-use, expiring, throttled; the code is issued per child by a coach or admin |
| `claim_player_profile(token)` | Atomically links a player record to a user |
| `log_match_result(...)` | Atomic match logging: result + status + appearances + ratings in one transaction |
| `update_own_registration_numbers(mysafa, id)` | Narrow, field-limited self-edit for a claimed player — added after discovering the general player self-edit path was silently broken for anyone past the initial claim (020) |
| `delete_player_photo(player_id)` | Narrow self-service: a parent or the player themself can clear their own photo (025) — same reasoning as the function above, RLS can't restrict which column a broader UPDATE grant would touch |

All SECURITY DEFINER functions set `search_path = public, pg_temp` to
prevent search-path injection.

---

## Row Level Security model

```
coach   → reads/writes data for teams they coach (via team_coaches, not just a single coach_id column)
player  → reads their own player record (profile_id = auth.uid())
parent  → reads players linked via parent_player_links
admin   → reads/writes all data within their academy
```

No application-level authorization layer exists on top of this — Supabase
enforces it at query time. Server actions add a secondary check only where
RLS alone can't express the constraint cleanly (e.g. "does this coach
actually coach this specific team" before a mutation with side effects
beyond a single row).

---

## AI layer

Thirteen Gemini-backed server actions, grouped by file, each grounded in
FIFA's Long-Term Player Development framework, the 4-Corner Model, SAFA's
National Development Programme, and CAF youth development principles:

| File | Capabilities |
|---|---|
| `coach-assistant.ts` | Conversational assistant (multi-turn), suggested XI, full match plan |
| `tactics.ts` | Positional role explainer, tactical concept explainer, play describer, opponent counter-analysis |
| `session-generator.ts` | 5-drill training session generator |
| `ai-insights.ts` | Player coaching insights |
| `development-plan.ts` | Personal development plan (player or coach) |
| `match-report.ts` / `parent-report.ts` | Post-match report, parent-facing report card |
| `academy-health.ts` | Academy-wide health report for the admin analytics page |

All thirteen share `squad-context.ts`, which assembles one team's real
data — players with position, form, and training attendance against the 75%
policy, squad attribute averages, recent results, and past meetings with an
upcoming opponent — into a single text brief passed into the prompt. The
brief is rebuilt per request rather than cached, and every prompt is
instructed never to invent a player, rating, or statistic not present in it.

**`thinkingConfig.thinkingBudget` is explicitly set to `0` on every one of
these calls.** The model defaults thinking to automatic, and thinking tokens
are deducted from the same budget as the visible answer — on the tight
budgets these features use (600–1200 tokens), unbudgeted thinking could
silently consume the entire request before writing a single word of the
real answer, truncating it with no error anywhere. See `web/CLAUDE.md` for
the full note; any new direct-answer AI feature needs the same setting.

Model IDs are centralised in `src/lib/ai-models.ts` (`AI_MODEL`,
`AI_MODEL_DOC`) after a model retirement broke every hardcoded call site at
once — changing models is now one edit, or an environment variable with no
code change.

---

## Document extraction pipeline (SAFA registration PDFs)

`src/app/actions/player-import.ts` reads a SAFA/LFA registration card sheet
(several player cards per page) and produces reviewable rows before
anything is written to the database — nothing here is trusted blind.

- **Text**: Gemini reads the whole PDF (`AI_MODEL_DOC`), returning one row
  per card in a fixed JSON schema.
- **Photos** (`src/lib/pdf-headshots.ts`): these cards are *generated*, not
  scanned, so every graphic — crest, QR code, badge, headshot — is its own
  embedded image object. `pdf-lib` walks the PDF's object graph for every
  embedded JPEG of plausible portrait size (restricting to JPEG specifically
  excludes the crest/QR/badge graphics, and a corrupted or hand-edited photo
  slot, for free); `pdf.js`'s resolved operator list adds each photo's true
  on-page position and the text printed directly beneath it on the same
  card, when that can be determined. Neither pdf-lib's resource-dictionary
  key order nor the content stream's own paint order reliably matches visual
  layout — both were tried and both failed on a real document.
- **Matching** (`src/lib/headshot-matching.ts`): a photo binds to a player
  by the registration number printed on the same card — never by position in
  a list. A single missing or corrupted photo used to shift every photo
  after it one player up, silently putting the wrong child's face on a name;
  matching by identity means a bad card only costs that one player their
  auto-match. A match is accepted only when it's unambiguous on **both**
  sides — one photo, one player, and no registration number shared by two
  players on the same document. Anything that doesn't resolve cleanly
  surfaces in an "unassigned photos" tray for the reviewer to place by hand,
  rather than being dropped or guessed.
- **Re-uploads**: a card for a player already registered still carries their
  headshot — if that player has no photo yet, a later upload fills the gap
  (never silently replacing a photo already on file).

`src/lib/player-card-pdf.ts` runs the same idea in reverse: given a player's
verified details, it generates a downloadable registration card PDF in the
same landscape layout as a real SAFA card, with the academy's own crest and
a QR code pointing at the player's real Growfit passport page (not a
replica of SAFA's own verification system, which this app has no access
to).

---

## Tactics board

An interactive board (`src/components/tactics/`) built as a pitch-diagram
*animation studio* — the target was feature parity with dedicated tools
like The Tactics App and Final Third, not just a static drawing surface.

`src/lib/board-model.ts` is the single shared source of truth for shape
kinds, pitch/equipment definitions, and frame-interpolation math — both the
interactive SVG board (`tactical-board.tsx`) and the read-only shared view
(`play-viewer.tsx`) render off it, and the canvas recorder
(`lib/board-render.ts`) draws the same picture for video export. This
replaced three previously-diverging copies of the same drawing logic.

- 16 formation presets from 5-a-side to 11-a-side, with automatic player
  assignment by position and opponent set-up in the opposing half
- Switchable pitch sizes (full/half/third) and training grids, plus a
  placeable, draggable training-equipment set (cones, markers, mannequins,
  goals, bibs, poles, ladders, hurdles) — the board can lay out a training
  drill, not just a match shape. Formation presets are absolute coordinates
  in the canonical 100×150 board space, so only pitch-shaped surfaces
  (full/half/third) support them; training grids get their own space and
  deliberately don't
- Drawing tools (runs, passes, dribbles, freehand, zones, text) with
  undo/redo covering every board edit — including frame reordering,
  duplication, and duration changes, not just drawing
- Pitch overlays: thirds, half-spaces/channels, zone 14, cut-back zones
- A real keyframe timeline: per-frame `durationMs`/`ease` (old saved plays
  without them fall back to the original hardcoded 1100ms so they keep
  playing back identically), frame reorder/duplicate/insert, and a scrub
  bar that seeks to any point and lets a coach edit the pose at that exact
  frame. `interpolateFrames()` in `board-model.ts` is the one place
  playback, recording, and scrubbing all compute position — previously
  playback and recording each reimplemented the same easing math
- Player spotlight: a highlight shape bound to a token's `playerId` (not a
  fixed coordinate), so it follows that player through every frame
- Per-player notes, attached to a `playerId` inside the play's `data`
  rather than one free-text field for the whole play. `get_shared_play()`
  (migration 029) filters these before they ever leave the database — a
  viewer sees notes about themself (or, for a parent, their linked child)
  only; coaches/admins see all of them
- Frame-by-frame animation with playback, PNG export, and video recording —
  movement is derived from the arrows a coach actually draws
  (`src/lib/play-motion.ts`), not a separate manual "capture steps" step
- Saved plays (`tactic_plays`): concept tags, session/fixture links,
  filtering, templates, a shared player-facing animated view, and an
  optional coach voice note
- A tactical concept library, positional-role explainers, and a player
  position guide, all backed by the AI layer above

### Match Film (`tactics/film-board.tsx`)

A second, separate surface on the same `tactic_plays` table
(`surface = 'film'`, migration 028) for telestrating over a real moment
instead of a diagram: a locally-captured phone-clip frame or photo
(`lib/image-capture.ts`, resized client-side, never uploaded as video — only
the frozen frame is saved), or a live YouTube/Vimeo embed
(`lib/video-embed.ts`) drawn over with the same tool set, minus spotlight
(there's no token to bind it to). An embedded video is a cross-origin
`iframe` — the browser exposes no pixels to canvas for it, so freeze-frame
and PNG export are only available for the local-capture path; an embed can
only ever carry a live, transparent drawing overlay, which is a platform
constraint, not an oversight. Shared and viewed read-only via
`film-viewer.tsx`, branched on `surface` from `play-viewer.tsx`'s route.

---

## Testing

- **Unit/component** — Jest + Testing Library (`npm test`). Convention in
  this repo: no Supabase/network mocking — tests are either pure logic
  (`src/lib/__tests__/`) or pure rendering. Two pre-existing failures
  unrelated to recent work: `src/__tests__/validation.test.ts`,
  `src/components/__tests__/logo.test.tsx`.
- **End-to-end smoke** — Playwright (`npm run test:e2e`, config at
  `web/playwright.config.ts`, specs in `web/e2e/`). Deliberately needs no
  Supabase project: every test relies on the app's own graceful failure
  behaviour (redirect to login, 404 for an unknown token), which works
  identically against a real project, a paused one, or the placeholder
  values `npm run build` already uses elsewhere. See `web/e2e/README.md`
  for exactly what this suite catches (a broken auth guard, a route that
  used to render now 500ing) and — just as importantly — what it doesn't
  (no test here logs in as a real coach or parent; that needs a seeded test
  project, which doesn't exist yet).

---

## Rendering strategy

| Page type | Strategy | Reason |
|---|---|---|
| Dashboard pages | Server Component | Data fetched on server, no client JS overhead |
| Auth pages | `"use client"` | Browser APIs, Supabase browser client, no server data fetch on render — verified this is what lets the smoke tests run with fake Supabase credentials |
| Form components | `"use client"` with `useTransition`/`useActionState` | Progressive enhancement, pending state |
| Public passport, print/document views | Server Component, `SECURITY DEFINER` RPC | No auth required, RLS bypassed narrowly and deliberately |
| PDF-generating routes (`/api/players/:id/card`, reports) | Route Handler | Binary response, not a page render |

`getProfile()` uses `React.cache` for per-request deduplication — a layout
and its sub-layout both call it without issuing two DB queries.

---

## Project layout — web app (abridged)

```
web/
├── e2e/                          ← Playwright smoke tests + README
├── playwright.config.ts
├── src/
│   ├── proxy.ts                  ← global auth guard + rate limiter (Next 16's middleware.ts)
│   ├── app/
│   │   ├── (protected)/dashboard/
│   │   │   ├── admin/            ← players (search, import, manual card creation), teams, analytics, reports, academy settings
│   │   │   ├── coach/            ← squad, fixtures, training, tactics, assistant, announcements
│   │   │   ├── player/           ← passport, fixtures, training, tactics, development, records, announcements
│   │   │   └── parent/           ← children, per-child detail, fixtures, announcements
│   │   ├── actions/               ← 30 server action files, one per domain (see AI layer / pipeline sections above for the AI and import ones)
│   │   ├── api/
│   │   │   ├── players/[id]/card/ ← generated SAFA-style card PDF
│   │   │   ├── reports/           ← CSV/PDF exports
│   │   │   └── passport/[token]/  ← public passport JSON
│   │   ├── passport/[token]/      ← public player passport page (no auth)
│   │   ├── print/document/        ← print-friendly consent/registration document view
│   │   └── offline/               ← PWA offline fallback (must stay in proxy.ts's PUBLIC_PATHS)
│   ├── components/
│   │   ├── ai/                    ← one panel per AI capability
│   │   ├── tactics/                ← board, drawing tools, animation, voice notes
│   │   ├── attendance/             ← training + match forms, shared offline-queue-flush hook
│   │   ├── records/                ← document hub, consents, medical, player import review table
│   │   ├── fixture-notifier.tsx    ← Realtime toast on a new fixture (player layout)
│   │   ├── announcement-notifier.tsx ← same pattern, a new announcement (player + parent layouts)
│   │   └── ui/                     ← Badge, Button, Card, RatingRing, StatBar
│   └── lib/
│       ├── auth.ts                 ← requireUser(), getProfile()
│       ├── ai-models.ts            ← centralised Gemini model IDs
│       ├── fixtures.ts             ← isFixturePast(), fixtureStatusLabel/Variant()
│       ├── attendance.ts           ← the 75%-threshold rule, shared by the AI brief and the welfare surface
│       ├── player.ts               ← calculateAge(), getInitials() — was duplicated in ~12 files each
│       ├── headshot-matching.ts    ← identity-based photo↔player binding
│       ├── pdf-headshots.ts        ← PDF headshot extraction
│       ├── player-card-pdf.ts      ← SAFA-style card PDF generation
│       ├── offline-attendance-queue.ts ← IndexedDB queue for attendance writes made offline
│       └── supabase/{client,server}.ts
└── supabase/migrations/           ← 29 sequentially-numbered files, checked in but NOT auto-applied — see the gotcha below
```

---

## Design system

Tailwind CSS v4, single `@theme` block in `globals.css`, no shadcn/ui
dependency — components are written from scratch against the token set.
Full dark-mode overrides via `.dark {}`, toggled by `next-themes`.

A design review (kept out of this file for length — see the two-pass audit
in project history) found the interface currently reads as
machine-generated (uniform card radii, one text-size doing every job, brand
red defined as `#af2d35` in code versus the academy's actual institutional
`#A71817`) and proposed a specific fix. That work is designed but not yet
implemented — see the roadmap.

---

## Security posture

| Concern | Mitigation |
|---|---|
| Auth bypass | JWT verified server-side on every request via `proxy.ts` + `requireUser()`/`getProfile()` |
| Data leakage | Row Level Security on every table |
| SQL injection | Parameterised queries via the Supabase JS client only |
| XSS | React JSX escaping; no `dangerouslySetInnerHTML` |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| SECURITY DEFINER functions | All set `search_path = public, pg_temp` |
| Auth brute-forcing | Per-IP rate limit on `/auth/login`, `/auth/register` in `proxy.ts` (in-memory; needs a shared store like Upstash Redis beyond a single instance). `/auth/verify` was dropped from this list — dead Expo-OTP-era route, never existed as a page |
| Minors' data (POPIA) | ID numbers, medical notes and addresses are staff-only. The public passport RPC returns a derived integer age, never raw date of birth — true since migration 032; before that this row claimed it while the function returned the raw DOB. Coach rating notes are also no longer returned (032), and photo consent **is** enforced inside the RPC (023) |
| Access to a child's records | A parent link requires a single-use code issued per child by a coach or admin (032). Before that, `share_token` — the public passport URL, printed on every player card — was accepted as the credential, and `parents_manage_child_medical` is `FOR ALL`, so a self-linked stranger could read *and write* a child's medical record |

---

## Multi-tenancy

**This shipped** — the "near-term" item in the previous version of this
document is done. `academy_id` is on every table, RLS scopes every read and
write to it, and `/register-club` lets a new academy self-onboard at
signup. `DEFAULT_ACADEMY_ID`, dead code left over from the original
single-tenant pilot, has been deleted along with the rest of
`src/lib/constants.ts` (nothing else in the file had an importer either).

## Scalability notes

- **Read performance**: RLS helper functions (`auth_role()`,
  `auth_academy_id()`) hit `profiles` on every query. Migration
  `022_profiles_covering_index.sql` adds a covering index on
  `(id, role, academy_id)` so those lookups resolve from the index alone —
  written but **not yet applied**; nothing in this repo's dev environment
  runs migrations against the live project (see `web/CLAUDE.md`)
- **Real-time**: used for two things now — `FixtureNotifier` (a new fixture
  notifies players) and `AnnouncementNotifier` (a new announcement notifies
  players and parents), both the same `postgres_changes` INSERT pattern,
  wired into the player and parent layouts
- **File storage**: player photos live in Supabase Storage
  (`player-photos` bucket) with public URLs; bucket policies mirror RLS
- **Rate limiting**: currently in-memory per server instance — will silently
  under-count once there's more than one, per the note already in
  `proxy.ts`. Fixing this needs a real shared store (e.g. Upstash Redis)
  and credentials that only the academy's own deployment has — not
  something this environment can stand up on its own

# Product Roadmap

*Last updated 2026-09-06.* Growfit FA is built incrementally for a real
academy in Greater Durban. This document was badly out of date before this
pass — most of what it called "near term" and "medium term" shipped back in
May/June, and an entire tactics board, a 13-capability AI layer, and a PDF
import/registration-card pipeline shipped since with no mention here at all.
Rewritten from an actual audit of the codebase and commit history, not from
memory of what was planned.

---

## Shipped ✅

### Foundation & auth
- Email + password auth (login, register, forgot/reset password), role
  selection at signup (Coach / Player / Parent / Admin)
- `handle_new_user()` trigger auto-creates a profile on signup
- Role-based dashboard routing, global auth guard in `src/proxy.ts`
  (rate-limited on the auth routes)
- **Multi-academy, self-service**: `/register-club` lets a new academy
  onboard itself at signup — the original single-tenant pilot's
  `DEFAULT_ACADEMY_ID` is dead code now, not the live path

### Core coach workflows
- Multiple teams per coach, and multiple coaches per team via a team-level
  coach code (`team_coaches`)
- Squad management: add players (manually, by invite code, or in bulk from a
  PDF — see below), view by position, remove
- Fixtures: create, cancel **with a required reason** (shown to parents and
  players, not just logged internally), log a result (score, appearances,
  per-player ratings) atomically via `log_match_result()`
- Upcoming/Past is computed from kickoff time and logged status together,
  not the status column alone — a match that's happened but hasn't had its
  result logged yet reads as "Result pending," not a stale "Upcoming"

### Player passport & attributes
- Public passport at `/passport/:token`, no login required; QR code
  generation from the share token
- 25 attribute columns (6 core + 19 position-specific — tackling,
  first_touch, shot_stopping, etc.), 1–99 scale, coach-assessed
- Rating history + a rating trend chart
- Claim an unclaimed profile by share token; narrow self-service edit of
  MySAFA/ID numbers only (added after discovering the general self-edit
  path was silently broken post-claim)

### Parent engagement
- Link a child by share token at registration or from the dashboard
- Per-child fixtures, ratings, progress
- Relationship label (Parent / Guardian / Grandparent / Sibling / Other)

### Announcements
- Per-team broadcasts from coaches, read/dismiss tracking, "New" badge

### Training module
- Sessions with type, date/time, location, notes; ordered drills with
  optional video URL; a separate reusable drill library
- **AI session generator** — 5 drills per request, age/focus/duration/squad
  aware
- **Attendance**: coach-marked P/A/L/E per session (`training_attendance`)
  feeding the 75% policy threshold used by the AI coach assistant; separate
  player self-report ("attending"/"unavailable") on match fixtures
  (`match_attendance`)

### Documents & compliance
- 6 required document types per player per season (registration agreement,
  consent form, code of ethics, medical consent, POPIA consent, ID
  document), digital signing flow restricted to parents, admin completion
  view
- Medical & emergency contact record per player
- Player consents (POPIA / photo / transport / risk acknowledgement) —
  captured, exported in reports, **not yet enforced before display** (see
  Next)
- Print-friendly document view; CSV and PDF export for player records,
  attendance, and consent/document compliance

### Development pathways
- 5-category milestone framework (Technical, Tactical, Physical, Mental,
  Leadership), admin-configurable templates per age group, per-player
  completion tracking
- AI personal development plans (player and coach-facing)

### Media
- Photo/video uploads tagged to a player, attached to a fixture or session
- Player video clips

### Admin & reporting
- Academy-wide player search, team management
- Analytics dashboard: position distribution, rating trend, document
  compliance bar, AI academy health report
- CSV/PDF report exports

### Tactics board (a full feature area with no prior roadmap mention)
- 16 formation presets (5- to 11-a-side), automatic player assignment by
  position, opponent set-up
- Drawing tools (runs, passes, dribbles, freehand), undo/redo
- Pitch overlays: thirds, half-spaces/channels, zone 14, cut-back zones
- Frame-by-frame animation, PNG export, video recording — movement is
  derived from the arrows actually drawn, not a separate manual step
- Saved plays: concept tags, session/fixture links, filtering, templates,
  a shared player-facing animated view, coach voice notes
- Tactical concept library, positional-role explainers, player position
  guide

### Squad-aware AI (13 capabilities, also unmentioned in the prior roadmap)
- Shared squad-context brief (real ratings, form, attendance, results) —
  every AI feature answers with actual players and numbers, never invented
  ones
- Conversational coach assistant, suggested XI, full match plans
- Play describer and opponent counter-analysis from the tactics board
- Match reports, parent report cards, player insights, academy health
  report, development plans, session/drill generation
- Read-aloud for AI output at the touchline

### Player import & registration cards (shipped this cycle, several
correctness passes)
- Bulk-import players from a scanned SAFA/LFA registration PDF sheet: text
  read by Gemini, one row per card, reviewable before anything is created
- Headshot extraction from the same PDF, matched to a player **by the
  registration number printed on the card** — not by position in a list,
  after two earlier position-based approaches each turned out to mismatch
  on a real document
- Unassigned photos surface in a review tray instead of being silently
  dropped or guessed at
- A later PDF upload backfills a headshot for a player already registered
  but missing a photo (manual entry or an earlier import with a bad photo)
- Manual player card creation for a player already SAFA-verified with no
  card on file — generates a downloadable card PDF in the real SAFA layout,
  with the academy's own crest and a QR to the player's Growfit passport

### Testing & tooling infrastructure (this pass)
- Playwright smoke suite (`web/e2e/`) — needs no Supabase project, catches
  a broken auth guard or a route that used to render now crashing
- Regression test suite for the headshot-identity-matching logic, extracted
  into its own testable module
- `web/CLAUDE.md` Known Gotchas doc

### UX foundation
- Responsive layout (desktop sidebar + mobile bottom nav), dark mode, PWA
  manifest + service worker + install prompt + offline fallback page
- Coach dashboard "what's next" smart cards, colour-coded chips, dashed
  empty states

---

## Next

Ordered within each horizon by how much it costs the academy for it to keep
not existing, not by how interesting it is to build. The safeguarding and
correctness items at the top of "Near term" are graded **Breaks the job** or
**Costs real time** in the source audit — everything past them is a genuine
improvement, not a gap.

### Near term (weeks, not sprints — these are small)

- **Enforce photo consent before display.** Captured and exported in
  reports; never checked before rendering a photo anywhere, including the
  public, unauthenticated passport page. A parent can tick "no photos" today
  and have it make no difference.
- **A welfare check-in surface.** The 75% attendance threshold is described
  as triggering a welfare check-in in both the academy's own documentation
  and the AI assistant's system prompt — but nothing surfaces it anywhere a
  human would see it unprompted. It exists only as something the AI
  assistant will mention if a coach happens to ask. This is the single
  biggest gap between what the platform claims to do and what it actually
  does for a real child-protection concern.
- **Let a parent delete their child's own photo without a developer.**
  There is no delete path for a player's photo or, more broadly, for a
  player record at all — every other entity in the schema has one.
- **A real deletion/erasure path more broadly** — POPIA's right to erasure
  needs an actual answer, not "ask a developer."
- **Fix `/offline`-style auth-guard gaps proactively** — found by building
  the smoke suite, not by design. Worth a quick audit of `proxy.ts`'s
  `PUBLIC_PATHS` against every top-level route now that a test exists to
  catch the next one automatically.
- ~~**Delete `DEFAULT_ACADEMY_ID`.**~~ **Done.** `src/lib/constants.ts` had
  no other importer at all (`PILOT_JOIN_CODE` was equally dead), so the
  whole file is gone rather than leaving one dead export behind.
- ~~**Attendance marking must surface a failed save.**~~ **Done.** Both
  attendance forms now distinguish a real write failure (shown inline,
  optimistic state rolled back) from a network failure (queued to retry,
  not silently dropped) — see the offline write queue below.

### Medium term

- **The design pass.** A full audit (kept out of the architecture doc for
  length, in project history) found the interface reads as
  machine-generated — every card the same radius, one text size doing every
  job, the brand red in code (`#af2d35`) not matching the academy's actual
  institutional colour (`#A71817`). A specific, three-direction design
  proposal exists and was reviewed; implementing the chosen direction
  (landscape "team sheet" look, real type hierarchy, semantic colour where
  red only ever means "something needs action") is scoped but not started.
- **Seed a test Supabase project for real end-to-end coverage.** The
  Playwright suite deliberately stops at "does the app not crash" because
  there's no seeded project to log in against. A `supabase/seed.sql` with
  one academy/coach/parent/player/squad, plus a saved auth state per role,
  would unlock testing the flows that actually break in production:
  attendance under a bad connection, PDF import misattributing a photo, a
  cancelled fixture's reason reaching a parent.
- ~~**Offline attendance queueing.**~~ **Done.** A network failure (not an
  app-level rejection — RLS/validation errors still surface immediately)
  now queues the write to IndexedDB (`lib/offline-attendance-queue.ts`) and
  retries it on the browser's `online` event or the next mount. Background
  Sync was deliberately not used — no iOS Safari support, and this app
  can't assume Android.
- **A U15/U13/U11-scale document-status view for admins.** "Which players
  still owe a signed form, tonight" currently means opening players one at
  a time or downloading a CSV on a phone at night. The per-player document
  badge exists; a filtered, age-group-scoped list view doesn't.
- **Attendance form parity**: the training attendance form only offers
  Present/Absent while the match form and the stated P/A/L/E policy include
  Late and Excused — meaning "late" and "excused" currently register as
  absences against the 75% threshold on the training side.
- **Show training attendance on the squad-selection screen.** The data
  exists (it feeds the AI assistant's advice already) but isn't visible to
  the coach actually picking a squad.

### Long term

- **isiZulu (and other South African languages).** No i18n library exists
  yet and every string is a hardcoded literal across ~60 pages — this gets
  more expensive to retrofit every month it's deferred. Worth scoping even
  if not started, given who the app is actually for.
- **Talent marketplace (opt-in)** — players opt in to be discoverable by
  scouts/clubs by position, age group, location; contact stays in-app.
- **Tournament / league table management** — auto-calculated standings from
  logged fixtures.
- **Video highlight hosting** — currently link-only (Storage or an external
  YouTube/Vimeo link); no plan to transcode or host video ourselves.
- **Push notifications (mobile)** — contingent on the Expo shell at the repo
  root becoming an active target again; it isn't currently.
- **Audit log** — who changed what, when. More important as more than one
  coach/admin works in the same academy (already true via `team_coaches`).

---

## Architectural backlog

| Item | Priority | Notes |
|---|---|---|
| ~~Delete `DEFAULT_ACADEMY_ID`~~ | Done | Whole `constants.ts` removed — no importers left at all |
| ~~`profiles(id, role, academy_id)` index~~ | Done | Migration `022_profiles_covering_index.sql` written — **needs to be run against the live Supabase project**, nothing in this environment applies it |
| ~~Realtime for announcements~~ | Done | `AnnouncementNotifier`, same `postgres_changes` pattern as fixture notifications, wired into both player and parent layouts |
| ~~Offline write queue (attendance)~~ | Done | IndexedDB queue + retry-on-reconnect, scoped to attendance rather than a generic write layer — see Next → Medium term |
| Move auth-route rate limiting off in-memory | Medium | Needs a real shared store (e.g. Upstash Redis) and credentials this environment doesn't have; `proxy.ts` already flags this in a comment |
| Seed Supabase test project + Playwright auth states | Medium | Needs a real (test) Supabase project and credentials this environment doesn't have |
| i18n scaffolding | Low, rising | Cost compounds the longer it's deferred; not started this pass — everything above it was higher-signal for the time available |

---

## Non-goals

Unchanged, still deliberate:

- **Live match tracking** — real-time score infrastructure isn't justified
  for this use case
- **Financial transactions / payments**
- **Social network features** — likes, comments, follower graphs
- **Gamification** — points, leaderboards, streaks, unless clearly validated
  with users
- **Video hosting/transcoding** — link out, don't host
- **Custom AI/ML** (e.g. automated attribute scoring from video) — out of
  scope for the current team size

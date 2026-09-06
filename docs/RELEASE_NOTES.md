# Release Notes

What changed and when, in plain language. Grouped by the actual bursts of
work rather than by version number — this project doesn't cut formal
releases yet. Newest first.

---

## 2026-09-06 — Safeguarding, data rights, and a real registration-flow bug

Closes out every item on the "Near term" roadmap from the previous pass.

**Added**
- **Welfare check-ins.** The coach dashboard now shows every player across
  their teams below the 75% training attendance threshold, with a "Log
  check-in" action that keeps a persisted note. Previously this threshold
  was described as triggering a welfare check-in in the academy's own
  policy and the AI assistant's system prompt, but nothing surfaced it
  anywhere a human would see it unless they happened to ask the AI.
- **Self-service photo removal.** A parent (or the player themself) can now
  remove their own child's photo without asking a developer to run a manual
  update — there was previously no delete path for it at all.
- **Player erasure.** An admin can now permanently delete a player's entire
  record. There was no DELETE policy on the players table at all before
  this — not even an admin could remove one. POPIA's right to erasure now
  has an actual answer instead of "ask a developer."

**Fixed**
- A brand-new visitor with no account could never reach `/register-club` —
  the self-service academy signup page — because it was missing from the
  auth guard's public-route allowlist and got redirected straight to a
  login page they had no account to log into. This silently broke the
  platform's whole multi-academy self-onboarding pitch for anyone arriving
  without an existing session.
- Following a team invite link (`/join/[code]`) while logged out sent a
  visitor to a bare login page and, after signing in, dropped them on their
  generic dashboard — losing the invite code. The login redirect now
  preserves where they were headed and returns them there.
- The public, unauthenticated player passport page served a player's photo
  regardless of whether photo consent had actually been given — a parent
  unticking "photo consent" had no real effect anywhere. Now enforced
  inside the database function itself that serves the public passport.

**Behind the scenes**: the attendance-threshold rule (75%, over a rolling
window) was independently computed in two places already starting to
drift in small ways; consolidated into `lib/attendance.ts` so the AI
assistant's brief and the new welfare surface can't quietly disagree.

---

## 2026-09-06 — Attendance that survives a bad connection, and cleaning up duplicated logic

**Fixed**
- Marking attendance (training or match) now tells the coach the truth. A
  real save failure shows an error and un-does the optimistic tick; a
  network failure (the actual pitchside case — one bar of signal, not a
  broken write) queues the mark in the browser and retries it automatically
  once the connection's back, instead of the button just quietly stopping
  its spinner while nothing was ever saved.
- Age and initials were each being computed from scratch in about a dozen
  files — the same judgment call re-made independently everywhere it was
  needed, with no guarantee every copy agreed. Consolidated into
  `src/lib/player.ts`; every one of those ~24 call sites now calls the one
  function instead of re-deriving it.
- Deleted `DEFAULT_ACADEMY_ID`, dead code from the original single-tenant
  pilot with zero remaining importers — and the rest of the file it lived
  in, which turned out to be equally unused.

**Added**
- Announcements now notify players and parents the moment a coach posts
  one, the same Supabase Realtime pattern already used for new fixtures —
  no more finding out by opening the app and noticing a badge.
- A database migration for a covering index on `profiles(id, role,
  academy_id)`, the table the app's RLS checks hit on every single request.
  Written and checked in, but **not yet applied** — this environment has no
  live Supabase project to run it against; it needs to be run by hand
  against the real one.

**Not done, and why**: two other items from the architecture backlog need
things this environment doesn't have and can't fake — moving auth rate
limiting off in-memory needs a real shared store (Redis) and credentials
for it; seeding a real Supabase test project for full end-to-end coverage
needs, similarly, a real test project. Both stay open until someone with
that access picks them up.

---

## 2026-09-06 — Fixture accuracy and AI answers that don't cut off

**Fixed**
- A fixture that had already kicked off could still show as "Upcoming" for
  days, because that only ever changed once a coach manually logged the
  result. Fixture lists (coach, parent, player) now go by kickoff time —
  a played-but-unlogged match now reads "Result pending," not a stale
  "Upcoming."
- Cancelling a fixture now asks why, and shows that reason to parents and
  players — previously a cancelled fixture gave no explanation at all.
- The AI Coach Assistant's "Suggest XI" and "Match plan" answers were
  getting cut off inside a small scrolling box that was easy to miss on a
  phone. That box no longer clips — the answer reads like the rest of the
  page.
- Several AI features (suggested drills, coaching insights, academy health
  reports, development plans, match and parent reports) could stop
  mid-sentence on longer answers. The underlying cause: unbudgeted "thinking"
  tokens were quietly eating the space meant for the visible answer. Fixed
  across every AI feature, not just the ones that were reported.
- The PWA's own offline page was, ironically, unreachable while logged out —
  it redirected to the login page instead of showing "you're offline."

**Behind the scenes** — a Playwright smoke-test suite and a regression test
for the photo-matching logic below, so these classes of bug get caught
automatically going forward; see `docs/ARCHITECTURE.md` for what's covered.

---

## 2026-08-20 – 2026-08-21 — Registration cards and a fix for mismatched photos

**Added**
- Admins can now create a player's registration card by hand — for a player
  already verified with SAFA who has no card PDF on file — and download a
  card in the real SAFA layout, with the academy's crest and a QR code to
  the player's Growfit passport.
- Uploading a later PDF now fills in a missing photo for a player who's
  already registered (created manually, or imported earlier from a sheet
  whose photo didn't come through), instead of doing nothing for anyone
  already on file.

**Fixed** — a real, multi-step correctness bug, worth explaining plainly:
bulk-importing players from a scanned registration sheet could attach the
wrong player's photo to a name. The cause was matching photos to players by
their position in a list; a single card with a missing or unreadable photo
shifted every photo after it one player up. Photos are now matched by the
registration number printed on each card instead, and anything that can't
be matched with certainty is set aside for the admin to place by hand,
rather than guessed at or silently dropped.

---

## 2026-08-18 – 2026-08-20 — Tactics board, a squad-aware AI assistant, and PDF import

The single biggest release since launch.

**Tactics board**
- Draw up a formation from 16 presets (5- to 11-a-side), with players
  auto-placed by position and the opponent set up automatically
- Drawing tools for runs, passes, dribbles, and freehand marks
- Pitch overlays: thirds, half-spaces, zone 14, cut-back zones
- Play it back frame by frame, export as an image, or record it as a video
- Save plays with concept tags, attach them to a session or fixture, and
  share an animated version straight to the squad with a voice note

**AI Coach Assistant**
- Ask it anything about your actual squad — it answers using real ratings,
  attendance, and results, not generic advice
- "Suggest XI" and full pre-match plans, grounded in who's actually been
  training
- Explains a tactical concept or a position's role in plain language, and
  can describe a saved play back to you or break down an opponent from
  past meetings
- Read-aloud, for using it pitchside without needing to read a screen

**Player registration**
- Bulk-import players straight from a scanned SAFA registration PDF —
  reads names, dates of birth, and registration numbers automatically
- Multiple coaches can now be attached to one team via a team join code,
  rather than one coach per team

---

## 2026-06-04 – 2026-06-05 — Compliance, admin tools, and the first AI features

**Added**
- Full document & consent hub: the 6 documents required per player per
  season, with digital signing for parents and an admin completion view
- Medical & emergency contact records
- POPIA, photo, and transport consent capture
- Player attributes expanded from 6 to 25, grouped and position-specific
  (goalkeepers get shot-stopping and handling; outfield players get
  tackling, crossing, first touch, and more)
- Development Pathways: a 5-category milestone framework (Technical,
  Tactical, Physical, Mental, Leadership) admins can configure per age group
- Admin analytics dashboard and CSV/PDF exports for player records,
  attendance, and document compliance
- Coach-marked training attendance
- The first AI features: post-match reports, a parent-facing report card,
  an AI-generated training session with drills, and an academy-wide health
  report
- Any academy can now register itself and get set up independently, instead
  of everyone sharing one pilot academy
- Settings pages for every role, with password change

---

## 2026-05-26 – 2026-05-27 — Launch

**Added**
- Email + password accounts, with Coach, Player, and Parent roles
- Coaches: create teams, build a squad, schedule fixtures, log results with
  per-player ratings
- Players: a passport page — position, attributes, rating history — with a
  public share link and QR code, no login required to view
- Parents: link to a child's profile with a share code, follow their
  progress and fixtures
- Team announcements
- A training module: sessions with type, location, notes, and an ordered
  drill list
- In-app notification when a coach schedules a new fixture
- Installable as an app on a phone (PWA), with dark mode

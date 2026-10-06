# Release Notes

What changed and when, in plain language. Grouped by the actual bursts of
work rather than by version number — this project doesn't cut formal
releases yet. Newest first.

---

## 2026-10-06 — Four security fixes

**Fixed**
- **Signing out now clears the phone.** The offline attendance queue, unsaved board and minutes drafts, the Ask Growfit conversation and the saved copies of dashboard pages are removed, so the next person on a shared phone cannot open the last coach's pages. Attendance marks still waiting to send are lost if you sign out before reconnecting.
- **Erasing a player also removes simplified notes that name them.** Coach notes rewritten for a child are stored by their text, not by player, so erasure missed them. It now deletes any that mention the child's full name or first name.
- **Lint runs on every pull request** and fails on any warning. Four existing errors and two stale suppressions were fixed to start clean.
- **A player can no longer read a teammate's private coaching notes** by asking the database for a shared play directly (migration 070; the app works before it is run, but the gap closes only when it is).

---

## 2026-10-06 — Staff hats, director cards and problem presets

**Added**
- **Staff hats** (migration 069): an admin ticks hats on each coach or admin in Academy
  settings, Staff tab. A hat only chooses which cards someone sees; it gives no extra access.
  No hats shows every card, as before.
- **Admin Today cards by hat**: registration, welfare, this week's matches, open objectives,
  curriculum coverage this term, sessions per team this term. Cards with nothing to say stay hidden.
- **Tap-to-fill match problems**: after a match, under "The problem", Buhle's approved
  problems for the chosen phase and the team's age (U11 and below, and U13 and above). Typing your own
  words still works; an edited preset counts as your own words.

**Still to do**
- Objectives show on the director cards only after migration 067 is run.
- Coach Today cards by hat are not built.

---

## 2026-10-06 — Curriculum links and coverage

**Added**
- **What is this about?** on the Plan tab of a training session, and on each open
  objective in the week plan: tick the academy's curriculum items it covers. Optional,
  filtered to the team's age group, and hidden when none are written.
- **Coverage** tab in Academy settings (admins): per age group, the share of curriculum
  items trained this term, the items not touched yet, and for each item how many sessions
  it was trained in, the last day and any objectives pointing at it.

**Notes**
- Needs migration 068 (run). Objective ticks need migration 067 (not yet run).

---

## 2026-10-06 — Match to Training to Follow-up

**Added**
- **A weekly focus from the match**: when a coach logs a result, they can name what the
  team works on this week. The lowest-rated phase of play is suggested. A team keeps at
  most two open at a time.
- **This week** on the coach home and the week plan, with **Plan a session**, which
  opens the session builder with the problem filled in and counts the session against it.
- **Did we see the problem again?** at the next match (No, a bit, yes). The answer
  closes the focus with a verdict, and **Keep working on it** starts the next one.
- **What we worked on** on Squad Review: verdicts, sessions planned and the phase rating
  before and after.
- **A team line in the weekly family note**: "This week the team worked on ...", built
  from fixed wording, naming a phase of play and never a child. Coaches approve every
  note as before.
- A coach guide: `docs/guides/match-to-training.md`.

**Needs you**
- Run migration 067. Until then none of this shows, and nothing else breaks.

**Planned**
- UI and performance plan (`docs/FEATURE_SPECS/experience-quality.md`): measure first,
  then budgets, then fixes.

---

## 2026-10-02 to 2026-10-04 — A tactics board you can talk to, and a Today home for everyone

**Added**
- **Tactics board**: a dock (Players, Draw, Move, Coach AI); full-pitch formations
  with attack and defend shapes for both teams (plus 4-3-2-1); with and without
  ball shapes; a timeline scrubber; play folders; and **Tell the board** by voice
  or text ("overlap", "press", "shift across"), previewed before it is applied.
- **Sharing**: a WhatsApp-ready MP4 and a PDF handout of a play. The MP4 encode
  has not yet been tried on a real phone.
- **Playing-time planner**, **tactics homework**, **skill challenges**, and an
  academy **drill library**.
- **Positions with roles**, and age-relative attribute presets. The presets stay
  hidden until Buhle approves the wording.
- **Video analysis consent**: a recorded consent check before any clip of a child
  is analysed.
- **Today homes**: admin (registration health, teams to chase, welfare count),
  parent (next match or training, forms, the coach's weekly note) and player
  (Today and Passport tabs). Pages with several areas now use URL tabs.
- **Branding**: the academy's own name and crest across the app.
- **Error reporting**: Sentry on server, edge and browser, with personal data
  scrubbed.

**Fixed**
- `"use server"` files exported non-async values, which broke a build; they now
  export only async functions and a test guards it.
- Gemini calls retry, with an optional fallback model (`GEMINI_MODEL_FALLBACK`).
- Duplicate React keys on the board.

**Changed**
- Vercel now builds only `main`, so pull requests have no preview URL.

**Needs doing**
- Migrations `030`-`066` are live in production. Anything new needs running by
  hand in the SQL editor; see `MIGRATION_RUNBOOK.md`.
- Buhle to review the video-analysis consent wording and the attribute presets.
- Try Save as video, and dictation, on a real phone.

**Not done yet**
- Coach checks (CPR Part B, first aid) on the admin home need a new migration.
- Kit on the parent home, and the player Schedule, Learn and Me tabs.
- A live shared board.

---

## 2026-10-01 — A safeguarding fix, and AI results that are kept

**Fixed**
- **Any signed-in player or parent could request an AI critique of any child in
  the academy.** The development plan, player insights and academy health actions
  checked only that someone was signed in, and player records are readable
  academy-wide. They now require a coach or admin, and a coach must coach that
  player. A player's own Development page no longer offers the generator; their
  coach shares the plan with them once it is ready.

**Added**
- AI development plans are now **kept**: a plan made on Tuesday is there on
  Wednesday, asking again when nothing has changed is free, and regenerating
  carries the previous plan and what happened since, so it can say whether the
  last plan worked. A coach approves a plan before anyone else can see any of it.
- Coaching Insights and the Academy Health report are also kept, with a thumbs
  up/down, and the admin analytics page shows this month's AI use.
- Development: milestones are grouped under five colour-coded categories that now
  work in dark mode, and each player has a season-by-season history of what was
  signed off, when, and by whom.

**Needs doing before it works in production**
- Apply migration `045` (and `030`-`044`) -- see `MIGRATION_RUNBOOK.md`. Until
  then everything above still works; plans just aren't saved.

**Not done yet**
- Players and parents seeing an approved plan. It waits on a person reading real
  AI output for tone first; see `BACKLOG.md` item 1.7.

---

## 2026-09-16 — Tactics studio parity, Match Film, and a coach-lockout fix

**Fixed**
- A coach given their team's join/coach code at registration could
  previously end up with an unrecoverable account — wrong role, no
  academy attached, and no working way to self-heal (the recovery screen
  existed but had no database policy allowing the write it tried to make,
  so it just surfaced a raw permissions error). Registration now validates
  a code *before* the account is created, and redemption goes through one
  RPC (`redeem_access_code`) that checks which of the three lookalike code
  types it actually is before writing anything.
- Two privilege-escalation gaps found in review while fixing the above: a
  coach role could be granted through a code path never meant to grant it,
  and a client-controlled field on the profile-update path reached further
  than intended. Both closed.
- A play shared to a squad leaked every player's individual coaching notes
  to the whole squad, not just the player (or parent) each note was about
  — despite the UI's own copy promising otherwise. Caught in review before
  this reached a live database; `get_shared_play()` now filters notes to
  the viewer.

**Added**
- **Pitch sizes, training grids, and equipment** on the tactics board —
  full/half/third pitches, sized training grids, and a placeable,
  draggable equipment set (cones, markers, mannequins, goals, bibs, poles,
  ladders, hurdles). The board can now lay out an actual training drill,
  not only a match shape.
- **A real keyframe timeline** — per-frame duration and easing, reorder,
  duplicate, insert, and a scrub bar that edits the pose at any point in
  the animation — replacing a fixed, un-editable segment length.
- **Player spotlight and per-player notes** — a highlight that follows one
  player's token through an entire animation, and coaching notes attached
  to a specific player rather than one note field for the whole play.
- **Match Film** — a second telestration surface for drawing over a
  captured phone-clip frame, a photo, or a live YouTube/Vimeo embed, saved
  and shared to the squad the same way a diagram play is.

**Behind the scenes**: the SVG drawing board, the read-only shared-play
view, and the canvas video recorder had each grown their own copy of the
same shape and animation logic; consolidated into one shared module
(`lib/board-model.ts`) so a new shape, pitch, or equipment kind is defined
once instead of three times.

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

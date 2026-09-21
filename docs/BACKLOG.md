# Outstanding Work — One Backlog

*Written 2026-09-21. Everything not yet done, from all three planning docs,
deduplicated and put in one order.*

Three documents were each describing part of the remaining work and
overlapping badly — `IMPROVEMENT_PLAN.md` item 14 and `FEATURE_PROPOSALS.md`
proposal 4 are the same job; the design pass appears in two places;
attendance parity appears in three. This file is the single sequence. The
source documents stay authoritative for *why* each item exists and what it
involves; this one says **when**, and what blocks what.

**Source key:** `IP-n` = `IMPROVEMENT_PLAN.md` item, `FP-n` =
`FEATURE_PROPOSALS.md` proposal, `RM` = `ROADMAP.md`.

---

## Phase 0 — Blocked on something that isn't code

Nothing below Phase 0 changes these. They need a human with access, not a
commit.

| # | Item | What it needs | Source |
|---|---|---|---|
| 0.1 | **Apply migrations 030–037** | Someone with Supabase SQL-editor or CLI access | IP Step 0 — **verified, see `MIGRATION_RUNBOOK.md`** |
| 0.2 | Error reporting (Sentry or equivalent) | An account and a DSN | IP-6 — **seam built, see below** |
| 0.3 | Seed a test Supabase project + Playwright auth states | A real test project and credentials | RM — **`supabase/seed.sql` written and verified, see below** |
| 0.4 | Move rate limiting off in-memory | A shared store (Upstash Redis) and credentials | RM — **seam built, see below** |

**0.1 is not optional and not ranked.** Migration `035` fixes a `42P17`
recursion that fails *every* read of `players` — the squad page, the player
dashboard, the parent dashboard, the admin pages. `036` is what makes
training attendance recordable at all. `037` is what makes the calendar feed
resolve. Until they run, most of this app does not work in production and
nothing below matters.

None of this could be applied from here — no Supabase CLI, no project link,
no credentials. What *could* be done: stood up a throwaway local PostgreSQL
16 with Supabase's `auth.uid()`/roles reproduced, ran the full `001`→`037`
chain, and specifically reproduced the `42P17` recursion (restored migration
032's pre-035 policy shape, confirmed it fails, reapplied 035, confirmed it
resolves) rather than just checking the migration runs. Also proved 036's
constraint swap rejects the legacy RSVP values, and 037's token rotation and
cross-academy isolation. Full method and results in `MIGRATION_RUNBOOK.md` —
that document is what the person applying these should read, not this line.

**0.2 is the most valuable thing on this entire page.** Three separate fixes
in September were "make a swallowed error visible", and all three made it
visible by writing to a Vercel function log nobody reads. Until this exists,
the fourth silent failure will be found the same way: by a coach reporting it
weeks later.

Can't create a Sentry account from here, so `lib/report-error.ts` is the seam
instead: one `reportError()` call, used at every site that used to end in a
bare `console.error`, that degrades to structured console output today and
starts shipping to a real tracker the moment `SENTRY_DSN` exists — no call
site changes. It also redacts anything that looks like the personal data this
academy holds under POPIA (ID numbers, medical notes, contact details) before
anything is logged, so the seam doesn't become its own compliance problem
once a DSN is added.

**0.4 now covers two things.** `proxy.ts`'s auth limiter and the per-user AI
budget added this month are both in-memory, so on a multi-instance deployment
the real ceiling is the limit times the instance count.

**0.3** — `supabase/seed.sql` now exists: one academy, five logins (admin,
head coach, assistant coach, parent, and the parent's linked child with her
own login), a ten-player U13 squad, two training sessions with attendance
marked across every P/A/L/E state (deliberately including two players
genuinely below the 75% threshold and one excused case), three fixtures
(completed with a logged result, upcoming, cancelled with a reason), both
coaches' attribute assessments of the same player, milestones, mixed-status
documents, and a fixed calendar-feed token. Run end-to-end against the same
local PostgreSQL 16 harness used for the migration verification (auth.users/
auth.identities reproduced) — confirmed idempotent, confirmed the attendance
percentages land exactly as designed, confirmed `get_public_passport()` and
`get_calendar_events()` both return correct data from it, confirmed RLS lets
each seeded role read what it should. **Not** verified: an actual GoTrue
login, since no live Supabase project exists in this environment — confirm
that the first time this runs against a real one. Playwright auth states
(step 2 of the e2e README's plan) still need writing on top of this.

**A dormant bug found while writing the seed, not fixed here:**
`handle_new_user()`'s `IF v_role NOT IN ('player', 'parent')` evaluates to
`NULL` (not `TRUE`) when signup metadata has no `role` key at all, since
`NULL NOT IN (...)` is `NULL` in SQL and plpgsql's `IF` only branches on
`TRUE` — so the fallback-to-`'player'` never fires and the profile insert
hits `profiles.role`'s `NOT NULL` constraint instead. Every real signup path
in this app (`auth/register`, `register-club`) does send a role, so this
isn't reachable through the UI today; it would be reachable from a direct
Admin API call or a future OAuth/magic-link signup with no metadata. Filed
here rather than patched, since it's a one-line change to a SECURITY DEFINER
trigger that closed a real privilege-escalation path (migration 027) and
deserves the same deliberateness as that migration got, not a drive-by fix
discovered while writing test fixtures. Pick it up as part of 1.5's audit.

Same shape as 0.2: `lib/rate-limit.ts` talks to Upstash's REST API directly
over `fetch` (no SDK, and REST rather than a TCP client is what actually
works in the Edge runtime `proxy.ts` runs under) when
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, and falls back
to today's in-memory Map otherwise — both callers switch with zero code
changes. Tested against a mocked Upstash response (request shape, pipelined
INCR/PEXPIRE-NX/PTTL, and failing *open* on a Redis error so a broken limiter
degrades toward "no limit" rather than locking out every login) but never
against a real Upstash instance, since none exists in this environment.
Verify against a real one before leaning on it in production.

---

## Phase 1 — Small, and felt every week

Ordered by how often the academy hits the problem. All are days, not sprints.

### 1.1 Attendance: P/A/L/E parity — `FP-1`, `RM` — **Done**
The training form offers Present/Absent only while the policy and the match
form use P/A/L/E, so **late and excused currently count as absences against
the 75% welfare threshold**. That is a correctness bug wearing a feature's
clothes, and it corrupts the welfare page, the squad filter and the AI brief
simultaneously. Fix the states first; then default everyone to Present so a
coach taps only the exceptions.

Marked twice a week for three squads. Nothing else recurs that often.

**What it actually was.** `training_attendance.status` still carried
migration 005's RSVP constraint (`'attending' | 'unavailable'`) while the app
wrote `'present' | 'absent'`, so **every training attendance write failed**
with 23514 — and the three readers disagreed about the column on top of that.
Migration `036` aligns it with `match_attendance`; one vocabulary now lives in
`lib/attendance.ts`. **One-tap marking** is also done: `markAllPresent()`
upserts Present for every player not yet marked in a single write, and the
training attendance form shows a "Mark remaining N present" button next to
the header whenever anyone is unmarked — the coach taps once, then only
corrects the exceptions.

### 1.2 Injury / availability state — `FP-6`
There is no way to record that a player is currently injured. Squad selection
and the AI both treat an injured child as available, while the AI's own system
prompt forbids suggesting an injured child play — it has no way to know.
Needs a migration, so it lands behind 0.1.

### 1.3 Training attendance on the match squad-selection screen — `RM` — **Done**
Distinct from the squad-list work already shipped: the coach picking Sunday's
team in the log-result flow still cannot see who trains. The data is already
assembled for the AI brief. `lib/training-attendance.ts` now shares the
same query/window/vocabulary the AI brief and squad list use, and both
`LogResultForm` call sites (the dedicated log-result page and the inline
form on the fixture detail page) show each player's rolling training
attendance percentage next to their position, flagged red below the 75%
threshold.

### 1.4 Two-tier AI models — `FP-8` — **Done**
A "what does this concept mean" explainer costs what a full match plan costs.
`ai-models.ts` already centralises the id and already has a second slot for
document work; this is a third plus one argument per call site. Cheaper calls
mean the AI budget can be more generous, not less. Added `AI_MODEL_LITE`
(`GEMINI_MODEL_LITE`, falling back to `AI_MODEL` when unset) and routed the
two pure definitional explainers — `explainPositionalRole` and
`explainTacticalConcept` — through it. Everything that weighs real squad
data toward a selection or planning decision (`suggestLineup`,
`generateMatchPlan`, `describePlay`, `analyseOpponent`, the coach assistant
chat, and every report/plan generator) stays on the default model, since a
wrong answer there has a child's game time or a misdiagnosed player behind
it, not just a slower definition.

### 1.5 Audit the remaining `getCoachedTeamIds` filters — `IP S-4`
`updateTeam`/`deleteTeam` were silently no-opping because an app-level filter
was doing authorization RLS already did correctly. The same helper still wraps
`addPlayerToSquad`, `removePlayerFromSquad`, `createPlayer` and several page
reads. Apply that fix's own reasoning to each, deliberately, rather than
waiting for the next silent no-op.

Also pick up while in this territory: `handle_new_user()`'s `IF v_role NOT
IN ('player', 'parent')` silently mis-handles a NULL role in signup metadata
(evaluates NULL, not TRUE, so the `'player'` fallback never fires) — found
while writing `supabase/seed.sql`, not currently reachable through the app's
own signup forms, full detail in that file's header comment and in Phase
0.3 above.

### 1.6 Clear the standing lint debt
Not glamorous, but it is now load-bearing: `tactical-board.tsx` carries seven
`react-hooks/refs` errors and `ai-insights.ts` / `development-plan.ts` carry
five `no-explicit-any`. Real findings get lost in a baseline of known ones.

---

## Phase 2 — Medium, and changes what the academy can do

### 2.1 Subscribable `.ics` feed — `FP-2` — **Done (migration 037 pending)**
Highest ratio of parent-facing value to code written. The data exists; an
`.ics` feed is a route handler and a text format. A parent subscribes once and
every fixture and time change lands in the calendar app they already use — no
notification to build, and it keeps working with no signal.

The timezone lesson from `toDateTimeLocal` applies directly.

**Shipped:** a per-person revocable token on `profiles`, a SECURITY DEFINER
`get_calendar_events` resolving it (same pattern as `get_public_passport`),
and `/api/calendar/<token>.ics`. Deliberately **not** reusing
`players.share_token` — migration 032 exists because that token had already
been overloaded as a second credential once. Still to do: **the month-grid
calendar view** inside the app, which is the other half of `FP-2`.

### 2.2 Registration status as a funnel — `FP-3`, `RM`
Rows are players, columns are the six documents, filterable by age group, with
a paste-ready chase message for the outstanding parents. SAFA/LFA registration
is mandatory to compete; discovering a gap on Sunday morning is the expensive
version of this problem.

### 2.3 Term reports parents can keep — `FP-5`
One PDF per player per term: attendance, milestones across the five corners,
ratings, a coach's note, the attribute passport. Every input exists and the
PDF pipeline exists — this is mostly assembly. It is also the artefact that
makes the academy look like an institution rather than a WhatsApp group.

### 2.4 Age-group eligibility and duplicate checks — `FP-7`
Flag any player whose age falls outside their team's band, and any two players
sharing an ID number, a SAFA number, or name-plus-DOB. Fielding an overage
player is a forfeit and a reportable matter under the agreement parents sign.

### 2.5 Stream the three long AI generators — `IP-15`
Match plan, match report, session generator. Sits behind 3.1: if the output
becomes structured, the streaming surface changes anyway.

### 2.6 Quick-assess mode + squad median marks — `IP-17`
A coach assessing fifteen players after training faces 450 slider decisions.
Show the position's top five, with a squad median tick on each slider.

### 2.7 Shared `<PlayerPassportCard>` — `IP-18`
The public passport, coach page, player dashboard and parent child page render
the same concept from four code paths. They have already drifted once —
the empty-state fix in September had to be applied to one of them alone.

### 2.8 Offline reads — `FP-9`
Attendance writes queue offline; everything else assumes a connection. A coach
at a ground with no signal cannot see emergency contacts, which is exactly what
the Injury & Medical Emergency Policy assumes is at hand. Cache squad,
contacts and next fixture, and label the view with when it was last updated.

### 2.9 Multi-coach visibility — `FP-10`
Attribution on the surfaces where two coaches can disagree without noticing —
who assessed what and when, who logged which check-in, who marked the
register. Not the full audit log below; just legibility.

---

## Phase 3 — Large, and needs a decision before code

### 3.1 Structured AI output + one **Apply** action per feature — `IP-14`, `FP-4`
The single largest jump in usefulness available, and the reason the AI layer
currently stops one step short of being useful. Thirteen capabilities all
return prose: the suggested XI cannot populate the board, the generated
session cannot become a session, the match plan is not saved to the fixture it
was written for.

**Blocked on product decisions, not effort.** What does an applied XI do to an
existing squad selection? Does a generated session land as a draft or a real
row? What happens when a coach edits after applying? Those want answering
before any code.

### 3.2 Persist AI artefacts — `IP-16`
Saving a match plan against its fixture needs a new table. Behind 0.1: adding
a migration nobody can run makes the unapplied backlog worse.

### 3.3 Board state → zustand, extract panels — `IP-19`
`tactical-board.tsx` is 2,000 lines with 27 `useState` hooks, and `zustand` is
already a dependency. Wants a test suite around the board first — refactoring
the academy's most complex surface with no safety net is how this goes wrong.

### 3.4 The design pass — `IP-20`, `RM`
Every card the same radius, one text size doing every job, red spent
decoratively rather than semantically.

**Note:** the roadmap refers to "a specific, three-direction design proposal
[that] exists and was reviewed". It is not in this repository. Either find it
or redo that step — starting a full visual pass without it means re-litigating
a decision that was already made.

---

## Deferred — real, but not this season

| Item | Why it waits | Source |
|---|---|---|
| **i18n / isiZulu** | ~60 pages of hardcoded English, no library. Cost compounds monthly, but nothing above it is optional. Worth *scoping* before it grows again. | IP U-5, RM |
| **Audit log** | More valuable once 2.9 exists and more than one coach is routinely active | RM |
| **Tournament / league tables** | Auto-standings from logged fixtures; wants 2.1's calendar work first | RM |
| **Talent marketplace (opt-in)** | Genuine value to players, but it is a second product with its own safeguarding surface | RM |
| **Push notifications (mobile)** | Contingent on the Expo shell becoming an active target, which it currently is not | RM |

---

## Non-goals — unchanged, and worth restating

From `ROADMAP.md` and `FEATURE_PROPOSALS.md`, deliberately not being built:
live match tracking, payments and fees, social features, gamification, video
hosting, custom AI/ML attribute scoring from video, in-app messaging (the
academy runs on WhatsApp; a second inbox nobody checks is worse than none),
and a parent-facing leaderboard — ranking children by Overall changes what the
rating is for, in a way that is hard to undo once parents have seen it.

---

## If you only do four things

1. **Apply the migrations** (0.1). Nothing works properly until this happens.
2. **Add error reporting** (0.2). Stop finding bugs by waiting for a coach to
   mention one.
3. ~~**Fix attendance P/A/L/E** (1.1).~~ **Done** — and it was worse than
   described: every training attendance write was failing against the
   database's constraint, which is why the welfare page was flagging the
   whole academy.
4. ~~**Ship the `.ics` calendar feed** (2.1).~~ **Done.**

Both land behind 0.1: they need migrations `036` and `037` applied.

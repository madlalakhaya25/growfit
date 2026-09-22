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

### 1.2 Injury / availability state — `FP-6` — **Done**
There was no way to record that a player is currently injured. Squad
selection and the AI both treated an injured child as available, while the
AI's own system prompt forbids suggesting an injured child play — it had no
way to know. Migration `039` adds `players.availability_status`
(`available`/`injured`/`unavailable`, defaulting to `available`) plus an
optional note and an audit stamp (who/when). `setPlayerAvailability()` lets
a coach or admin set it from the player's own profile (a new
`PlayerAvailabilityControl` on both the coach and admin player-detail
pages) — no new RLS needed, since `player_staff_update` already governs
this column exactly as it does every other `players` field.

Every squad-selection surface now reads it: `buildSquadContext` puts an
`INJURED`/`UNAVAILABLE — DO NOT SELECT` flag at the *front* of a flagged
player's line in the AI brief (not buried after ratings/attendance, where a
"never suggest this" instruction is easy to skim past) plus an explicit
`UNAVAILABLE:` summary line; `suggestLineup` and `generateMatchPlan` gained
an explicit selection rule against it; and the human coach picking a squad
by hand sees the same flag as a badge on `LogResultForm` (match
squad-selection) and the coach squad list — the AI and the human now work
from the same fact instead of the AI knowing something the person picking
the team couldn't see.

Every new query for this column tolerates migration `039` not having run
yet (`isMissingAttributeColumn`'s `42703` check, reused from the attributes
fallback) rather than failing outright and taking an already-working page
down with it — the exact trap `web/CLAUDE.md`'s own "migrations are checked
in, not applied" gotcha warns about.

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

### 1.5 Audit the remaining `getCoachedTeamIds` filters — `IP S-4` — **Done**
`updateTeam`/`deleteTeam` were silently no-opping because an app-level filter
was doing authorization RLS already did correctly. Went through every other
`getCoachedTeamIds` call site (`squad.ts`, `fixtures.ts`, `training.ts`,
`tactic-plays.ts`, `announcements.ts`, `squad-context.ts`, `welfare.ts`, and
every `/dashboard/coach/*` page read) against the actual RLS policy each
one's table carries, rather than assuming they all share one shape.

**Two different findings, opposite in direction:**

- For `teams` writes, RLS (`team_staff_write`/`team_staff_update`) already
  implements the full intended authorization (`is_admin_or_coach()` +
  academy match) — the app-level "teams I coach" filter was *narrower* than
  intended and broke the admin-only case, which is what the earlier fix
  addressed.
- For every other table these actions touch (`team_members`, `players`,
  `fixtures`, `tactic_plays`, `announcements`), RLS is deliberately
  **academy-wide** for staff (`is_admin_or_coach()` alone, no per-team
  check) — so the app-level `getCoachedTeamIds()` filter in `squad.ts` /
  `fixtures.ts` / `training.ts` / `announcements.ts` is not redundant with
  RLS the way `teams`' was. It is the *only* thing stopping one coach from
  writing to another coach's team in the same academy — confirmed by
  reading `is_admin_or_coach()`'s own definition (`role IN ('admin',
  'coach')`, no team check at all). These are all correct as they stand and
  now say so in a comment at their shared `getCoachTeamIds`/
  `getCoachTeamById` helper, so a future "this looks redundant with RLS"
  cleanup doesn't remove a real security boundary.

**A third, more serious finding, found by taking the same question to
`training_sessions`/`training_drills`/`training_attendance`:** those three
tables' RLS (migrations 003/005/012) still gate every command on `coach_id
= auth.uid()` — literally whoever created the row — never updated when
migration `019` introduced `team_coaches` and multi-coach teams. A second
coach on a team (this academy's real structure: Buhle coaching across every
division alongside Sphe/Khaya's own) could not see, mark attendance for, or
manage drills on a session a colleague created, on their own shared team.
Reproduced against a real Postgres instance before fixing (see
`docs/MIGRATION_RUNBOOK.md`'s 038 section) and fixed in migration `038`,
which brings all three onto the same academy-wide pattern already used by
`fixtures`/`tactic_plays`. The matching app-level `coach_id = user.id`
checks in `training.ts`, `attendance.ts` and both training-session pages
were also replaced with team-scoped checks — fixing the RLS alone would not
have helped, since the app-level check would have kept blocking the same
co-coach before the request ever reached the database.

**A fourth, unrelated bug found along the way:** `setAttendance()` (the
player's own "Going" / "Can't make it" RSVP, a different, older write path
into the same `training_attendance` table) still wrote migration 005's
`'attending'`/`'unavailable'` vocabulary — which migration `036` (P/A/L/E
parity, above) stopped accepting entirely. Every tap of "Going" or "Can't
make it" has been failing outright with `23514` since `036` shipped; `036`'s
own testing covered the coach-marking path only. Fixed by translating to
`present`/`excused` at write time (matching `036`'s own historical-row
translation) and fixing the matching read-side cast on the player's session
page, which compared against values the column can no longer hold.

Also picked up while in this territory: `handle_new_user()`'s `IF v_role NOT
IN ('player', 'parent')` silently mis-handles a NULL role in signup metadata
(evaluates NULL, not TRUE, so the `'player'` fallback never fires) — found
while writing `supabase/seed.sql`. Reproduced live again while seeding this
item's own migration-038 verification fixtures (a bare `role` claim with no
key at all reliably hits the NOT NULL violation this describes). Still not
reachable through the app's own signup forms, and still deliberately not
patched as a drive-by fix to a security-sensitive `SECURITY DEFINER`
trigger — full detail in `supabase/seed.sql`'s header comment and Phase 0.3
above; left for deliberate, dedicated handling.

**A fifth round, found while building 2.8's offline emergency-contacts
view:** the same "predates `team_coaches`" bug in `038` turned out not to
be fully swept. Auditing every remaining RLS policy that joins through
`teams t` the way `038`'s targets did turned up five more, all still
gating on `teams.coach_id = auth.uid()` alone — three of them read-only,
which is exactly how this class of bug hides (a denied co-coach sees an
empty page, not an error): `coaches_read_medical`, `coaches_read_consents`
and `coaches_read_documents` (a co-coach saw no emergency contacts, no
consent status, and an empty 2.2 document funnel for players on their own
team), plus `coaches_manage_match_attendance` (couldn't mark who played)
and — the most severe of the five — the `log_match_result()` SECURITY
DEFINER function behind the "Log result" form itself, which returned a
misleading `{"error": "Fixture not found."}` to a co-coach submitting a
real Sunday result for a fixture that plainly existed. Fixed in migration
`040` with the same OR-against-`team_coaches` pattern `get_calendar_events`
(`037`) already used correctly, and reproduced-then-fixed the same way as
`038` (full detail in `docs/MIGRATION_RUNBOOK.md`'s 040 section) —
including checking `log_match_result()`'s actual effects, not just its
return value, since a plausible-looking rewrite of its
appearances/ratings upserts would have silently deleted every *other*
coach's ratings for a shared fixture (`player_ratings` is keyed on
`(fixture_id, player_id, coach_id)`, not `(fixture_id, player_id)`) — so
its replacement body was copied verbatim rather than reconstructed from
memory.

### 1.6 Clear the standing lint debt — **Done**
Not glamorous, but it was load-bearing: `tactical-board.tsx` carried seven
`react-hooks/refs` errors and `ai-insights.ts` / `development-plan.ts`
carried five `no-explicit-any`. Real findings were getting lost in a
baseline of known ones. Full sweep (49 findings across 32 files, down to 0)
found two more real bugs along the way — a `voice-note-recorder.tsx` state
leak across plays, and a missing runtime validation on `drills.ts`'s
`difficulty` field — documented in the commit that shipped it.

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
been overloaded as a second credential once.

**The month-grid calendar view**, the other half of `FP-2`, is also done:
`components/calendar/month-calendar.tsx` is a plain Server Component (month
navigation is just links to `?month=YYYY-MM`, no client JS needed) showing
fixtures and training sessions as coloured dots on a month grid. Wired into
`/dashboard/parent/fixtures` as a List/Calendar toggle (`?view=calendar`) —
parents are this feature's primary audience, same as the `.ics` feed itself.
The component is generic (`CalendarEvent[]` + a base path), so the coach and
player fixtures pages can adopt it the same way without rebuilding it.
Unit tested for the actual grid math (day placement, month/year wrap at the
Dec→Jan boundary, the query-string-preserving nav links).

### 2.2 Registration status as a funnel — `FP-3`, `RM` — **Done**
Rows are players, columns are the six documents, filterable by age group, with
a paste-ready chase message for the outstanding parents. SAFA/LFA registration
is mandatory to compete; discovering a gap on Sunday morning is the expensive
version of this problem.

**Shipped:** `/dashboard/admin/players/documents` — one row per player, one
column per `DOCUMENTS` entry, an age-group filter pill row, and a "Copy chase
message" button (clipboard only, deliberately not a `wa.me` deep link: a
stored phone number isn't reliably in the international format that needs,
and a confidently-wrong prefilled link is worse than one extra paste). Added
`isDocComplete()` to `lib/document-definitions.ts` as the one place "is this
document actually done" is decided — upload-only docs need `'uploaded'`,
everything else needs `'signed'` — matching `DocumentHub`'s own per-group
counts as a single per-cell check. Linked from the players list, which also
still has its own per-player X/6 badge for a quick glance.

### 2.3 Term reports parents can keep — `FP-5` — **Done**
One PDF per player per term: attendance, milestones across the five corners,
ratings, a coach's note, the attribute passport. Every input exists and the
PDF pipeline exists — this is mostly assembly. It is also the artefact that
makes the academy look like an institution rather than a WhatsApp group.

**Shipped:** `/print/term-report/[playerId]` — reuses the exact print-to-PDF
pattern already established at `/print/document/[playerId]/[type]`
(`PrintTrigger`/`PrintButton`, imported directly rather than duplicated) so
"Term report" is just another `window.print()` page, not new PDF
infrastructure. One page, five sections: attendance over the same 90-day
rolling window the welfare check-in uses (`attendanceWindowStart()`/
`summariseAttendance()` from `lib/training-attendance.ts` — there's no
explicit term-boundary column in the schema, only a `season` year string,
so this reuses the same practical proxy rather than inventing a second
one), development milestones grouped by the five corners
(`development_milestone_templates` joined to the current season's
`player_milestone_completions`), the full match-ratings history with an
average, the attribute passport (`buildAttributeSnapshot()`, already used
elsewhere), and a "Coach's note" pulled from whichever coach's
`player_attributes.notes` was most recently `assessed_at` — the same
"most recent wins" convention the passport itself already uses for
attribute values, applied to notes instead. Linked as "Term report" from
the three places a coach or parent already looks at one player: the admin
player page, the coach's squad player page, and the parent's child page —
each opens it in a new tab next to the existing "Download card" link.

### 2.4 Age-group eligibility and duplicate checks — `FP-7` — **Done**
Flag any player whose age falls outside their team's band, and any two players
sharing an ID number, a SAFA number, or name-plus-DOB. Fielding an overage
player is a forfeit and a reportable matter under the agreement parents sign.

**Shipped:** `lib/eligibility.ts` — `ageGroupBand()` reads a two-year-wide
band from a "Uxx" team name (deliberately wide rather than a precise SAFA
cutoff date, which varies by association/season and would produce
confident-looking false positives) and `findDuplicates()` groups players
sharing a normalised ID number, SAFA number, or name+DOB, treating two blank
fields as never a match. Both are advisory, surfaced as a "Needs a look"
banner plus a per-row badge on `/dashboard/admin/players` — not a block,
matching how the welfare threshold works (surfacing the question, not
deciding it). Unit tested (`lib/__tests__/eligibility.test.ts`).

### 2.5 Stream the three long AI generators — `IP-15` — **Deliberately skipped this pass**
Match plan, match report, session generator. Sits behind 3.1: if the output
becomes structured, the streaming surface changes anyway.

Left alone rather than implemented: 3.1 is explicitly "blocked on product
decisions, not effort" (what an applied XI does to a squad selection,
whether a generated session lands as a draft or a real row, and so on) —
decisions this pass has no basis to make. Streaming today's plain-prose
output would mean re-wiring the response handling again once 3.1 lands and
the shape changes from prose to structured data with an **Apply** action;
that is the wasted-effort scenario the backlog's own "sits behind 3.1" note
is warning against, not a reason to do it twice.

### 2.6 Quick-assess mode + squad median marks — `IP-17` — **Done**
A coach assessing fifteen players after training faces 450 slider decisions.
Show the position's top five, with a squad median tick on each slider.

**Shipped:** `getQuickAssessKeys()` in `lib/attributes.ts` picks the five
attributes worth rating without the full form — one per corner in turn
(round-robining for a second pass when a position doesn't have all five
corners populated), reusing each position's existing attribute ordering
rather than a new hardcoded "top five" list. `computeSquadMedians()`
computes the squad's median for each of those, over players actually
assessed on it. `PlayerAttributesForm` gained a "Quick assess" toggle that
swaps the full grouped form for just those five sliders, each with a tick
mark at the squad median. Fixed a real bug found while wiring this up:
saving from quick-assess mode would otherwise have submitted the *full*
attribute set including untouched ones still at their 50-default — for a
player's first-ever assessment, that means fabricating "50" for every
attribute the coach never actually looked at, exactly what
`upsertPlayerAttributes`'s own "only send what the form showed" comment
already warns against. `handleSubmit` now submits only the five
quick-assess keys when the toggle is on. Unit tested
(`lib/__tests__/attributes.test.ts`).

### 2.7 Shared `<PlayerPassportCard>` — `IP-18` — **Done**
The public passport, coach page, player dashboard and parent child page render
the same concept from four code paths. They have already drifted once —
the empty-state fix in September had to be applied to one of them alone.

**Shipped:** `components/player/player-passport-card.tsx`, covering exactly
the part that was byte-for-byte identical across all five surfaces (the
admin player page turned out to duplicate the same markup too, so it got
the same treatment) — photo-or-initials, the rating ring, name and
position, with a `variant` prop for the one real layout split (the player
dashboard lays photo+name+ring out in a single row; everywhere else stacks
photo+ring above name+description). Badges, the attribute summary, a
remove-photo button, the QR code — everything that genuinely differs per
surface — stayed as page-owned children/props rather than being forced into
one shape. Each refactor was checked diff-by-diff against the original
markup for a 1:1 content match; the only intentional behaviour change is
one cosmetic reorder on the player dashboard (a remove-photo button now
renders after the badges instead of before).

### 2.8 Offline reads — `FP-9` — **Done**
Attendance writes queue offline; everything else assumes a connection. A coach
at a ground with no signal cannot see emergency contacts, which is exactly what
the Injury & Medical Emergency Policy assumes is at hand. Cache squad,
contacts and next fixture, and label the view with when it was last updated.

**Shipped:** `/dashboard/coach/squad/emergency`, with no new
offline-storage code at all — the key finding was that `public/sw.js`
already caches every navigation request network-first with a cache
fallback, for the whole app, so any ordinary Server Component page a coach
opens once while they still have signal is already available with none.
The actual gap wasn't caching, it was that no single page combined squad +
emergency contacts + next fixture into the one view worth pre-loading
before setting off for an away match. The page shows each player's
allergy/condition/medication flags (filtering out `'NONE'`-valued fields so
only genuinely flagged conditions render, as red badges) and up to two
emergency contacts each with a `tel:` link, plus the team's next upcoming
fixture, and a "Loaded `<timestamp>`" label rendered into the HTML at
request time — so a page served from the service worker's cache correctly
shows when it was last actually fetched rather than claiming to be live.
Linked from the main squad page. While wiring this up, a broader audit
(`grep -rn "JOIN teams t\|FROM teams t" supabase/migrations/*.sql`) for the
same "predates `team_coaches`" bug class migration 038 fixed turned up five
more instances — see migration `040` and 1.5 below; two of them
(`player_medical` and `player_documents` RLS) would otherwise have made
this exact feature and the 2.2 document funnel both return nothing for any
co-coach who isn't a team's original `teams.coach_id`.

### 2.9 Multi-coach visibility — `FP-10` — **Done (partial)**
Attribution on the surfaces where two coaches can disagree without noticing —
who assessed what and when, who logged which check-in, who marked the
register. Not the full audit log below; just legibility.

**Shipped:** two of the three named surfaces. The welfare panel's "last
checked in 12 Sept" now reads "...by Sphe Mlotshwa" (`welfare_checkins.
noted_by` was written since migration 024 but never selected or shown — a
coach had no way to tell whether a logged check-in was their own or a
colleague's). The training register now shows "Last marked by <name>,
<date>" using `training_attendance.marked_by`/`marked_at`, same gap, same
fix. Found and fixed a real, currently-live bug on the same page while
doing this: the session detail page's own "Attendance" summary bar
(distinct from the register form below it) still filtered on migration
005's RSVP vocabulary (`'attending'`/`'unavailable'`), which migration 036
stopped writing entirely — it has shown 0 going, 0 can't-make-it and every
player "pending" regardless of the real register underneath, for every
session, since 036 shipped. Removed the dead block rather than reimplementing
it, since the register form directly below already shows the correct P/A/L/E
summary. **Not done:** "who assessed what and when" for ability
attributes — the coach-count is already shown ("Squad average · 3
coaches"), but not which coaches or when each one last updated it; left for
a follow-up rather than extending this session's scope further.

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

**Shipped (with a deliberate scope narrowing):** structured output + an
Apply action for 3 of the app's 13 AI generators — `suggestLineup`,
`generateMatchPlan`, `generateSessionPlan` — not all 13. The other ten stay
prose-only; this was a scope decision made up front, not a shortfall.

Each of the three now calls Gemini in JSON mode (`responseSchema` built with
`Type.OBJECT`/`Type.ARRAY`, following `extractPlayersFromPdf`'s existing
pattern in `player-import.ts` exactly, including its JSON.parse +
regex-fallback for when the model wraps JSON in prose anyway) and returns
both a `structured` field and the original prose field, the prose now
rendered server-side from the structured data by a plain template — no
second model call — so every existing `AiProse` display call site kept
rendering unchanged.

Three Apply actions, one per generator:
- **Suggested XI → new saved play.** `coach-assistant-panel.tsx` matches
  each suggested name to the team roster (case-insensitive full name), maps
  positions to formation slots via a new `mapNamedPositionsToSlots()` in
  `board-model.ts` (reusing `assignToSlots`' exact/group/leftover cascade
  from 3.3 step 1, after normalising the AI's freeform position label to a
  real `POSITIONS` value), and calls `savePlay` with **no** `playId` — always
  an insert, so applying a suggestion can never silently overwrite whatever
  the coach currently has open on their board (confirmed, non-negotiable).
- **Session plan → drills.** Two entry points. A brand-new session's form
  maps `structured.drills` directly, replacing the old `parseAIDrills` regex
  parser entirely. An already-existing session gets a new `addDrills()`
  batch action (one multi-row insert, `sort_order` computed once up front,
  rather than N sequential `addDrill` calls that could leave a session
  half-populated on a partial failure). Both entry points pack the AI's five
  rich fields into `training.ts`'s 500-character `description` cap via a
  shared `packDrillDescription()` (`lib/drill-description.ts`, unit tested),
  truncating `instructions` first. **This is a documented, deliberate
  lossy-by-design tradeoff** — the AI's structured output is genuinely
  richer than the DB column allows, and the fix is truncation, not expanding
  the schema to chase it.
- **Match plan → `fixture_match_plans`.** See 3.2 below for the table; the
  Apply action (`match-plans.ts`) upserts on `fixture_id`, so re-applying
  overwrites the plan in place — no history/versioning (confirmed decision,
  same convention as `tactic_plays`' own upsert-on-`playId`). Its app-level
  `requireCoachTeam` guard mirrors `tactic-plays.ts`'s own, and matters for
  the same reason documented in 1.5: RLS on this table is academy-wide, not
  per-team.

Verified: `tsc`, `jest`, `eslint`, and full `npm run build` (dummy Supabase
env vars) all pass at every step, plus new unit tests for
`mapNamedPositionsToSlots` and `packDrillDescription`. **Not verified in
this environment:** an actual click-through of all three AI panels and
their Apply buttons against a real Gemini key and a real Supabase project —
there was neither in this session. The prose-rendering templates were
written by matching the old prompts' exact label wording against
`AiProse`'s parsing regexes line by line, but a live check against real
model output, and a real end-to-end Apply (suggest → apply → open the board
and see the saved play; generate a session → apply → open the session and
see the drills; generate a match plan → apply → confirm the fixture's saved
plan), are both still outstanding before this should be considered fully
proven.

### 3.2 Persist AI artefacts — `IP-16`
Saving a match plan against its fixture needs a new table. Behind 0.1: adding
a migration nobody can run makes the unapplied backlog worse.

**Shipped:** `supabase/migrations/041_fixture_match_plans.sql` — a new
`fixture_match_plans` table (`fixture_id UNIQUE`, one row per fixture,
`data JSONB` so the shape can evolve without another migration), modelled on
`tactic_plays` (migration 015) but using the current academy-wide RLS shape
from migrations 038/040 (`is_admin_or_coach() AND academy_id =
auth_academy_id()`) rather than 015's older split-by-command policies. The
0.1 blocker this item names (no live Supabase access to apply a migration)
still holds — 030 through 040 are proven-but-unapplied for the same reason —
so 041 joins that same queue rather than clearing it.

**Not verified against the local PostgreSQL 16 harness** that migrations
035-040 were each proven against, per an explicit instruction this round to
skip that step. `docs/MIGRATION_RUNBOOK.md`'s new 041 section documents this
plainly: what was checked instead (the policy's shape against the real
helper functions from migration 001, and against `tactic_plays`' own
already-proven identical shape), and what a person with real Supabase access
should still confirm — cross-academy isolation and the upsert-on-conflict
behaviour — before this is trusted in production.

### 3.3 Board state → zustand, extract panels — `IP-19`
`tactical-board.tsx` is 2,000 lines with 27 `useState` hooks, and `zustand` is
already a dependency. Wants a test suite around the board first — refactoring
the academy's most complex surface with no safety net is how this goes wrong.

**Shipped (step 1 of 2 — pure-helper extraction):** `groupOf`, `shortLabel`,
`uid`, `assignToSlots`, and `compress`, plus the `BoardPlayer`/`BoardTeam`
interfaces, moved out of `tactical-board.tsx` into `lib/board-model.ts` as
plain exported functions — no behavior change, `tactical-board.tsx`
re-exports the types so `board/page.tsx`'s existing import keeps working.
This is the safety net the zustand/panel-extraction step above still needs:
`assignToSlots`'s exact-role → same-group → leftover-fill cascade is now
covered by unit tests in `lib/__tests__/board-model.test.ts`, along with
`compress`'s home/away mirroring and `groupOf`'s null/unknown fallback. The
zustand slices and panel extraction themselves are still outstanding.

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

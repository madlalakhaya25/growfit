# Migration Runbook — 030 → 050

*Written 2026-09-21. Backlog item 0.1. Extended the same day to cover 038-039
(Phase 1, backlog items 1.2/1.5), again on 2026-09-22 to cover 040 (more of
1.5's same audit), and again on 2026-09-22 to add 041 — see that section for
why 041's verification is not held to the same standard as everything else
on this page. Extended on 2026-10-01 to backfill 042–044 and add 045.

Sixteen migrations are checked in and **not applied to the live Supabase
project**. Nothing in a Claude Code session can apply them: there is no
Supabase CLI, no project link and no credentials in that environment. This
document exists so the person who *can* apply them does not have to take it
on faith.

**If a verification query below errors with `42P01: relation "..." does not
exist`, that table's own migration hasn't run yet either** — this runbook
covers 030 onward on the assumption `001` through `029` are already applied.
A brand-new Supabase project needs every migration run in order starting
from `001_schema.sql`, not just the ones listed here; `supabase db push` (or
pasting each file into the SQL editor in numeric order) handles that
correctly on its own.

Every claim below was verified against a real PostgreSQL 16 instance, with
Supabase's `auth.uid()`, `anon` / `authenticated` roles and grants
reproduced, and the app's own seed shapes inserted.

---

## Why this is urgent

| Migration | What is broken until it runs |
|---|---|
| `035` | **Every read of `players` fails** with `42P17 infinite recursion detected in policy for relation "players"` — squad page, player dashboard, parent dashboard, admin pages |
| `036` | **Every training attendance write fails** with `23514`, which in turn makes the welfare page flag the entire academy and the AI brief report the whole squad below the 75% threshold |
| `037` | Calendar subscriptions resolve to an empty feed |
| `038` | A co-coach on a team cannot see, mark attendance for, or manage drills on a session a colleague created — `training_sessions`/`training_drills`/`training_attendance` RLS still gates on `coach_id = auth.uid()` (migration 003/005/012, predates the `team_coaches` multi-coach model added in `019`) |
| `039` | No way to record a player as injured/unavailable — squad selection (by hand and by the AI) treats every registered player as equally available |
| `040` | A co-coach who isn't a team's original `teams.coach_id` cannot log a match result at all (`logMatch()` fails with a misleading "Fixture not found"), cannot mark match-day attendance, and cannot see any player's emergency contacts, consent status or document compliance — five more policies/functions from before the `team_coaches` multi-coach model (`019`), missed by `038`'s first pass |
| `030`–`034` | Expanded player attributes, passport attributes, parent-link verification, tactical attributes, claim verification |

---

## Verification performed

Full chain `001` → `037` applied to a clean database.

**Result: every migration applies cleanly except `006_realtime.sql`**, which
fails with `publication "supabase_realtime" does not exist`. That is an
artefact of bare Postgres, not a defect — the publication is created and
managed by Supabase. It will apply normally on the real project.

### 035 — the RLS recursion

Reproduced the failure before proving the fix, rather than only checking the
fix runs:

1. Seeded a player, a parent, and a `parent_player_links` row — the shape
   that makes `players.player_parent_read` evaluate
   `parent_player_links`' own policy.
2. Restored migration 032's inline-subquery policy (the pre-035 shape).
   Reading `players` as that parent → `ERROR: infinite recursion detected
   in policy for relation "players"`. **The bug is real and reproducible.**
3. Applied 035. The same read returns 1 row. The coach's read returns 1 row.

### 036 — attendance constraint

- Post-migration constraint is
  `CHECK (status = ANY (ARRAY['present','absent','late','excused']))`.
- All four values accepted by INSERT and UPDATE.
- The legacy RSVP value `'attending'` is now **rejected** with `23514`,
  confirming the old vocabulary cannot be written back by accident.

### 037 — calendar feed

- A parent issues a token via `issue_calendar_token()` as `authenticated`.
- `get_calendar_events(<token>)` called as **`anon`** — which is what a
  calendar client is — returns exactly that parent's child's fixture and
  training session.
- **Rotation revokes:** after `issue_calendar_token(true)`, the old token
  returns 0 rows and the new one returns 2.
- **Cross-academy isolation:** a second academy with a fixture named
  `SECRET OPPONENT` does not appear in the first parent's feed (0 rows).
- An unknown token returns 0 rows rather than raising — an empty calendar,
  not a failed subscription a client might cache.

### 038 — training multi-coach RLS

Reproduced the bug before proving the fix:

1. Seeded one academy, one team, two coach profiles both in `team_coaches`
   for that team (a real multi-coach setup), a training session created by
   Coach A only, and one player in the squad.
2. As **Coach B** (a real co-coach, never the creator): `SELECT` on
   `training_sessions`/`training_drills` for that session returned **0
   rows**; `INSERT` into `training_attendance` for it raised `new row
   violates row-level security policy`; `UPDATE` on the session matched 0
   rows. **The bug is real and reproducible** — a co-coach could not see or
   act on a colleague's session at all, on a shared team, in the same
   academy.
3. Applied `038`. The same four operations as Coach B now succeed: the
   session and its drill are visible, the attendance insert succeeds, and
   the session update returns 1 row.
4. **Cross-academy isolation still holds:** a third coach profile in a
   *different* academy gets 0 rows on the same `SELECT` and an RLS
   violation on the same `INSERT` — the fix widened "any coach on this
   team" to "any coach/admin in this academy" (matching `fixtures`/
   `tactic_plays`/`players`/`team_members`'s existing pattern), not to
   "any coach anywhere."

### 039 — player availability

- Post-migration, every existing player defaults to `availability_status =
  'available'` with no migration-time data loss.
- As a coach (RLS `player_staff_update`, unchanged by this migration):
  updating a player to `'injured'` with a note succeeds and reads back
  correctly.
- An invalid status (`'benched'`) is **rejected** by the new CHECK
  constraint, confirming only `available`/`injured`/`unavailable` can ever
  be written.

### 040 — more multi-coach RLS

Same method as `038`: reproduced each bug on the pre-040 policy shapes
before fixing, using a team with a head coach (`teams.coach_id`) and a
second, non-head coach present only in `team_coaches`:

1. As the non-head coach, `SELECT` on `player_medical` for a player on
   their shared team returned **0 rows** — the emergency contact was
   invisible. `log_match_result()` returned `{"error": "Fixture not
   found."}` for a fixture that plainly existed. `INSERT` into
   `match_attendance` raised an RLS violation. **All three bugs reproduced.**
2. Applied `040`. All three now succeed as the non-head coach — and
   `log_match_result()`'s effects were checked, not just its return value:
   `match_results` actually holds the submitted score and `fixtures.status`
   actually moved to `'completed'`.
3. **Cross-academy isolation holds**: a third coach profile in a different
   academy gets 0 rows on the same `player_medical` read, the same
   "Fixture not found" from `log_match_result()`, and the same RLS
   violation on `match_attendance` — the fix widened "the team's original
   coach" to "any coach on this team," not to "any coach anywhere."

`log_match_result()`'s replacement body was copied verbatim from `001`,
not rewritten, specifically because a plausible-looking delete-then-insert
rewrite of its appearances/ratings upserts would have silently deleted
every *other* coach's ratings for a shared fixture — `player_ratings` has
one row per `(fixture_id, player_id, coach_id)`, not per `(fixture_id,
player_id)`.

### 041 — fixture_match_plans

**Not verified against the local PostgreSQL 16 harness that every other
migration on this page was proven against — a deliberate exception, made on
the record, not an oversight.** New table, new feature (Phase 3.1/3.2's
match-plan Apply flow, docs/BACKLOG.md), nothing currently broken depends on
it, so unlike `035`–`040` there is no live bug this needed to be reproduced
against first.

What was actually done instead: `041`'s single RLS policy —
`is_admin_or_coach() AND academy_id = auth_academy_id()` — is checked by
inspection against the exact two SECURITY DEFINER helpers migration `001`
defines (read in full, not assumed) and against `tactic_plays`' own
identically-shaped policy (`015_tactic_plays.sql`, already proven correct by
this document's `035`-era audit and in real production use since). Same
helpers, same boolean structure, same `FOR ALL` shape 038/040 established as
the current convention for a new staff-writable table — see the SQL file's
own header comment for the specific claims this reasoning supports (and, as
importantly, what it does *not* cover: co-coach-via-`team_coaches` scoping,
which this policy deliberately leaves to `match-plans.ts`'s app-level
`requireCoachTeam` check, not RLS).

**Before this is trusted in production, someone with real Supabase access
should do what this session couldn't:** run `041` against the actual
project (or a disposable branch of it) and confirm, with two real coach
profiles, that a coach on a different academy gets 0 rows / an RLS
violation on `fixture_match_plans`, and that `upsert(..., { onConflict:
"fixture_id" })` from `match-plans.ts` actually overwrites the existing row
rather than erroring on the unique constraint. Both are the kind of thing
that reads correctly on paper and still fails the first time it meets a
real Postgres instance's exact constraint-conflict behavior.

### 042 — academy_features, 043 — private_player_photos, 044 — fixture_delete

*Backfilled 2026-10-01; these shipped (PRs #36, #37, #41) without a runbook
entry.*

- **042** adds `academies.features JSONB NOT NULL DEFAULT '{}'`. Re-applies
  cleanly on the harness. The app reads it through `getAcademyFeatures()`,
  which treats a missing column or an absent key as "on", so deploying before
  applying it loses nothing.
- **043** flips the `player-photos` bucket to private, adds
  `player_has_current_photo_consent()` and a consent-aware `storage.objects`
  read policy (docs/BACKLOG.md 4.10, POPIA). **Not runnable on the local
  harness** — it needs Supabase's `storage` schema, which a plain PostgreSQL
  does not have (`relation "storage.buckets" does not exist`). It is therefore
  unverified here. **Apply it only after the app code that signs photo URLs
  is deployed** (`signPlayerPhotoUrls`), otherwise every existing photo link
  breaks the moment the bucket goes private. Confirm afterwards, as `anon`,
  that a photo URL for a child *without* current photo consent is refused.
- **044** adds the missing `DELETE` policy on `fixtures`
  (`fixture_staff_delete`). Re-applies cleanly on the harness. Which team a
  coach may delete from, and the refusal to delete a completed fixture, live
  in `deleteFixture()` — RLS here is academy-wide by design (see 1.5).

### 045 — ai_artefacts

The artefact store behind every persisted AI output
(docs/AI_AND_UX_PLAN_2026.md Step 1.1). One table, three policies.

**Verified on the local PostgreSQL 16 harness**, with the full `001`→`045`
chain applied, two academies, two coaches, two players, a parent linked to one
of them, and artefacts of every kind/status seeded:

| As | Reads | Result |
|---|---|---|
| player A | `ai_artefacts` | **exactly** A's approved `development_plan_shared` row — no `development_plan` row, no draft, no superseded row, nothing of player B's |
| player B | `ai_artefacts` | exactly B's shared row |
| parent of A | `ai_artefacts` | exactly A's shared row, nothing of B's |
| coach, same academy | `ai_artefacts` | every row (6) |
| coach, other academy | `ai_artefacts` | 0 rows |
| coach, other academy | `INSERT` into academy 1 | rejected by `WITH CHECK` |
| player | `INSERT` | rejected by `WITH CHECK` |
| coach, same academy | two-row insert (private + shared, as `approveDevelopmentPlan` does) | succeeds |

The first row is **the safeguarding boundary**: RLS is row-level, not
column-level, so the coach's private concern note is only safe because it
lives in a *different row* (`kind = 'development_plan'`) from the player-safe
copy (`'development_plan_shared'`). Re-applies cleanly (3 policies after the
second run).

**Graceful degradation.** Deploying the code before this runs is safe: every
read goes through `lib/ai-artefacts.ts`, which treats a missing table
(`PGRST205` / `42P01` — *table* codes, **not** the `PGRST204` / `42703` column
codes `isMissingAttributeColumn()` catches) as `available: false`, and the
caller falls through to a live Gemini call. The UI loses persistence, not
function. `friendlyError()` now also recognises both table codes.

**Erasure.** `ai_artefacts.subject_id` is polymorphic with **no foreign key**,
so deleting a player does not cascade. `deletePlayerRecord()` calls
`deleteAiArtefactsForSubject()` before the `players` delete and refuses to
proceed if that fails.

**Still outstanding — needs a live Supabase project:**

- Repeat the table above with real accounts. The single most important line
  is "player reads only their own `development_plan_shared`, never a
  `development_plan`".
- Whether a parent's `profiles.academy_id` is actually populated in this
  academy's real data (migration 032 sets it on verified link) — the parent
  view depends on it.
- Delete a seeded player through the admin UI and confirm zero surviving
  `ai_artefacts` rows for them.

```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'ai_artefacts';
-- expect 3: staff_all (ALL), player_read (SELECT), parent_read (SELECT)
```

### 048 — ai_artefacts_scouting_kind

Widens `ai_artefacts_kind_check` to add `'scouting_report'` (Phase 2 step 2.5).
The constraint name was confirmed against the live project (`045` creates it
inline, so it takes Postgres's default `ai_artefacts_kind_check`).

`ai_artefacts.kind` is a fixed list, so a new kind is **not** a code-only
change. Deploying the code before this runs is safe but silently useless:
`saveAiArtefact`'s insert fails the CHECK, is reported as a warning and
swallowed, and `generateScoutingReport` returns `persisted: false` — every
request then regenerates and bills the Gemini key again. 046 and 047 are
reserved by `BACKLOG.md` Phase 5.

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname = 'ai_artefacts_kind_check';
-- expect the original eight kinds plus 'scouting_report'
```

### 049 — ai_artefacts_play_roles

Phase 3 step 3.3 ("My job in this play"). Widens **both** fixed CHECK lists on
`ai_artefacts` (`ai_artefacts_kind_check` gains `'play_roles'`,
`ai_artefacts_subject_type_check` gains `'play'`; both names confirmed against
the live project) and adds `ai_artefacts_play_roles_player_read`, so a player
can read an **approved** play-roles artefact for a shared play on a team they
are an active member of. The kind list in 049 is the full list including
`'scouting_report'`, so it is correct whether or not 048 has run.

Until it runs the code is safe: generating still works but `persisted: false`
comes back, nothing can be approved, and the player page shows no "My job"
card.

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname IN ('ai_artefacts_kind_check','ai_artefacts_subject_type_check');
SELECT policyname FROM pg_policies WHERE tablename = 'ai_artefacts';
```

### 050 — ai_artefacts_age_rewrite

Phase 3 step 3.8. Widens both fixed CHECK lists again: `ai_artefacts_kind_check`
gains `'age_rewrite'` and `ai_artefacts_subject_type_check` gains `'text'`. Both
lists in 050 are the full lists including 048's and 049's additions, so 050 is
correct whichever of those have run. No policy is added: these rows are
staff-only and `ai_artefacts_staff_all` already covers them.

Until it runs the rewrite still works but is returned as not saved, so
rewriting the same note twice calls the model twice.

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname IN ('ai_artefacts_kind_check','ai_artefacts_subject_type_check');
```

### 051 — privacy_and_rsvp

Three read/write narrowings (stage 1 of the 2026-10-02 world-class plan). No
column is added to an existing table and no existing row changes.

- `tactic_plays`: read is staff (academy-wide) or, for a player, only plays
  `shared` with a team they are an active member of. Was: any academy member.
- `player_milestone_completions`: read is academy staff, the player, or a linked
  parent. Was: any academy member, notes included.
- `training_rsvps` (new): the player's own "going / can't" before a session
  starts. `players_manage_own_attendance` on `training_attendance` is dropped
  (the register is the coach's); players keep `players_read_own_attendance`.
  Attendance rows with `marked_by IS NULL` (written by the old RSVP tap) are
  COPIED to `training_rsvps` and left in place; the app ignores them in the
  register. Delete them only after looking at the count.

Verify with the query at the foot of `051_privacy_and_rsvp.sql`. The tactics board
and the player's "shared plays" page must still load for a coach and a player.

### 052 — drill_details

Adds a nullable `details JSONB` column to `training_drills` so a generated drill's
whole plan (setup, instructions, coaching points, duration, pitch diagram) is
kept instead of being cut to the 500-character description. Additive only: no
row changes, no policy changes, no index.

**Run it before the app version that reads the column is deployed.** The session
page selects `details`; against a database without the column that query errors
and the drill list comes back empty.

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'training_drills' AND column_name = 'details';
SELECT count(*) FROM training_drills WHERE details IS NOT NULL; -- 0 right after
```

### Idempotency

`030`–`040` were re-run against the already-migrated database. **All eleven
re-apply cleanly**, and the post-re-run state is still correct (parent can
read `players`; the attendance constraint is still the P/A/L/E one; `038`'s
and `040`'s policies still show the academy-wide/multi-coach shape; `039`'s
columns and constraint survive a second run). Running the set twice is safe.
`041` was not run at all in this environment (see above), so it has no
re-apply result to report yet either — its SQL uses the same `IF NOT
EXISTS`/`DROP POLICY IF EXISTS` guards as every other migration on this
page, so it is expected, not proven, to be idempotent.

---

## 053: academy terms

Adds `academy_terms` (name, start, end per academy). Additive: a new table with
RLS, nothing existing changes. Every academy member can read it, only admins can
write. Safe to re-run. Until it is run, the admin Academy page still loads and
the School terms card simply has nothing to list; "Set up terms" then reports a
friendly error rather than failing the page. Not yet applied in production.

---

## 054: player term reviews

Adds `player_term_reviews`: one row per (player, term, category) holding a band
from 1 to 4. Needs 053. Additive: a new table. Staff of the player's academy
read and write; the player and their linked parents read. The coach's private
notes are deliberately not in this table (row-level security cannot hide one
column). Safe to re-run. Until it is run, the coach's Assessment tab and the
parent page simply show no term review.

---

## 055: player self-assessments

Adds `player_self_assessments`: a player's own 1 to 5 rating per category per
term. Needs 053. Additive: a new table. The player reads and writes only their
own rows; staff of the academy read. Parents and other players cannot see it.
Safe to re-run. Until it is run, the player's rating card still renders but
saving gives a friendly error, and coaches see no "Player says" lines.

## 056: coach notes

Adds `coach_notes`: a short typed or dictated note about one player or one
training session. Text only; dictated audio is sent to the model to be written
out and is never stored. Additive: a new table. The author reads and deletes
their own notes; admins of the academy read and delete any (erasing a player
needs this). Other coaches, players and parents cannot read them. Safe to
re-run. Until it is run, the note box shows but saving gives a friendly error.

## 057: training effort

Adds a nullable `rpe` (1 to 10) to `training_attendance`: how hard a child found
a session, set by the coach after training. Feeds the squad readiness figure.
Additive: one column and a range check, no policy changes. Safe to re-run. Until
it is run, the "How hard was it?" row shows but saving gives a friendly error,
and readiness runs on attendance and ratings only.

## 058: family messages

Adds `family_messages`: a coach-approved short message for a child and their
family, used for match stories now and the weekly digest next. Additive: a new
table. Staff of the academy read and write; a player reads only their own and a
parent only their linked child's, and only once a coach has approved it. Drafts
are never visible to a family. Erasing a player erases their messages (real
foreign key). Safe to re-run. Until it is run, the coach's "Match stories" panel
shows but explains, and families see nothing extra.

## 059: footage consent check

Adds one function, `clip_consent_gaps(player_ids, season)`, which returns the
children who do NOT have photo and media consent for the season (no consent row,
consent not given, not in the caller's academy, or the caller is not staff). It
is the database half of the consent gate for footage of children, in the same
style as the public passport check in 023. Additive: one function, no table
changes. Safe to re-run. Nothing calls it until a video feature exists, so
running it changes nothing for coaches or families; until it is run, any future
footage feature is blocked with a message naming this migration.

---

## 060: video analysis consent

Adds `player_consents.ai_analysis_consent` (boolean, default false) and replaces
`clip_consent_gaps` so the footage gate needs it as well as photo and media
consent. Additive and safe to re-run. Every existing child starts without it, so
parents opt in on the consent form (an optional fifth box); declining changes
nothing else. Until it is run, saving the consent form still works for the four
required consents and the box is simply not stored.

---

## How to apply

Either route works. Take a backup first regardless.

**Supabase SQL editor** — paste each file in numeric order, `030` through
`045`, checking each succeeds before the next.

**CLI**, from a machine with it installed and linked:

```bash
supabase db push
```

### Afterwards

```sql
-- 035: should return 1 row per policy, none containing a bare
-- "FROM players" subquery.
SELECT polname FROM pg_policy WHERE polrelid = 'players'::regclass;

-- 036: expect only present / absent / late / excused.
SELECT status, count(*) FROM training_attendance GROUP BY status;

-- 037: both functions present and SECURITY DEFINER.
SELECT proname, prosecdef FROM pg_proc
 WHERE proname IN ('issue_calendar_token', 'get_calendar_events');

-- 038: none of these four policies should mention "coach_id = auth.uid()"
-- any more.
SELECT tablename, policyname, qual FROM pg_policies
 WHERE tablename IN ('training_sessions', 'training_drills', 'training_attendance');

-- 039: every existing player defaulted to 'available'.
SELECT availability_status, count(*) FROM players GROUP BY availability_status;

-- 040: none of these should mention "coach_id = auth.uid()" without an OR
-- against team_coaches alongside it.
SELECT tablename, policyname, qual FROM pg_policies
 WHERE tablename IN ('player_medical', 'player_consents', 'player_documents', 'match_attendance');
SELECT prosrc FROM pg_proc WHERE proname = 'log_match_result';
```

Then, in the app: open a squad page (exercises 035), mark a training
register (036), create a calendar link in Settings (037), have a second
coach on a shared team open a training session the first coach created
(038), mark a player injured from their profile (039), and have that same
second coach open a player's medical tab and log a match result for a
fixture on the shared team (040).

### If something goes wrong

Every one of these is re-runnable, so a partial failure can be retried from
the file that failed. `036` wraps its data translation and constraint swap in
a single `BEGIN`/`COMMIT`, so it either fully applies or does not apply at
all — there is no half-migrated attendance state to clean up.

---

## Reproducing this verification

The harness is a throwaway local Postgres. Roughly:

```bash
D=/tmp/pgverify && mkdir -p $D/data $D/sock && chown -R postgres $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data \
  -o '-k $D/sock -p 5433 -c listen_addresses=' -l $D/data/log start"
export PGHOST=$D/sock PGPORT=5433 PGUSER=postgres
createdb growfit
```

Then create the Supabase stand-ins the migrations assume — `pgcrypto`, an
`auth` schema with a `users` table, `auth.uid()` reading
`request.jwt.claim.sub`, and the `anon` / `authenticated` / `service_role`
roles with `GRANT`s on `public` — and run the files in order. Set
`request.jwt.claim.sub` to a profile's id to exercise policies as that user.

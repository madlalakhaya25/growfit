# Migration Runbook — 030 → 039

*Written 2026-09-21. Backlog item 0.1. Extended the same day to cover 038-039
(Phase 1, backlog items 1.2/1.5).*

Ten migrations are checked in and **not applied to the live Supabase
project**. Nothing in a Claude Code session can apply them: there is no
Supabase CLI, no project link and no credentials in that environment. This
document exists so the person who *can* apply them does not have to take it
on faith.

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

### Idempotency

`030`–`039` were re-run against the already-migrated database. **All ten
re-apply cleanly**, and the post-re-run state is still correct (parent can
read `players`; the attendance constraint is still the P/A/L/E one; `038`'s
policies still show the academy-wide shape; `039`'s columns and constraint
survive a second run). Running the set twice is safe.

---

## How to apply

Either route works. Take a backup first regardless.

**Supabase SQL editor** — paste each file in numeric order, `030` through
`039`, checking each succeeds before the next.

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
```

Then, in the app: open a squad page (exercises 035), mark a training
register (036), create a calendar link in Settings (037), have a second
coach on a shared team open a training session the first coach created
(038), and mark a player injured from their profile (039).

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

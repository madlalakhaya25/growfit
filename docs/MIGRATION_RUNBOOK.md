# Migration Runbook — 030 → 037

*Written 2026-09-21. Backlog item 0.1.*

Eight migrations are checked in and **not applied to the live Supabase
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

### Idempotency

`030`–`037` were re-run against the already-migrated database. **All eight
re-apply cleanly**, and the post-re-run state is still correct (parent can
read `players`; the attendance constraint is still the P/A/L/E one). Running
the set twice is safe.

---

## How to apply

Either route works. Take a backup first regardless.

**Supabase SQL editor** — paste each file in numeric order, `030` through
`037`, checking each succeeds before the next.

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
```

Then, in the app: open a squad page (exercises 035), mark a training
register (036), and create a calendar link in Settings (037).

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

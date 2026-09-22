-- 041_fixture_match_plans.sql
--
-- Persists the AI-generated match plan (Phase 3.1/3.2, docs/BACKLOG.md) once
-- a coach applies it to a fixture. Modelled on tactic_plays (migration 015)
-- — same JSONB-blob-so-the-shape-can-evolve reasoning — but using the
-- current academy-wide RLS shape (`is_admin_or_coach() AND academy_id =
-- auth_academy_id()`, see migrations 038/040) rather than 015's older
-- split-by-command policies, since a single FOR ALL policy is now the
-- established convention for a new staff-writable table.
--
-- `fixture_id` is UNIQUE: one plan per fixture, overwritten in place on
-- re-apply (`upsert(onConflict: "fixture_id")` in match-plans.ts) — no
-- history/versioning, matching tactic_plays' own upsert-on-playId
-- convention. This RLS is academy-wide, not per-team, exactly like
-- tactic_plays' — the app-level `requireCoachTeam`-style check in
-- match-plans.ts is the real "do you actually coach this team" boundary,
-- per docs/BACKLOG.md 1.5's finding that RLS here is deliberately coarse.

CREATE TABLE IF NOT EXISTS fixture_match_plans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  fixture_id  UUID        NOT NULL UNIQUE REFERENCES fixtures(id) ON DELETE CASCADE,
  team_id     UUID        NOT NULL REFERENCES teams(id)     ON DELETE CASCADE,
  coach_id    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fixture_match_plans_team_idx
  ON fixture_match_plans (team_id, updated_at DESC);

ALTER TABLE fixture_match_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fixture_match_plans_staff_all" ON fixture_match_plans;
CREATE POLICY "fixture_match_plans_staff_all" ON fixture_match_plans
  FOR ALL TO authenticated
  USING (is_admin_or_coach() AND academy_id = auth_academy_id())
  WITH CHECK (is_admin_or_coach() AND academy_id = auth_academy_id());

-- Safe to re-run: CREATE TABLE/INDEX IF NOT EXISTS, and the policy is
-- dropped by name before being re-created.
--
-- Verified by hand against migrations 001-040's actual RLS shape (no local
-- PostgreSQL 16 harness run for this one, unlike 038-040 — see
-- docs/MIGRATION_RUNBOOK.md's 041 section for why and what to check by hand
-- against a real Supabase project before this is trusted in production):
--   * `is_admin_or_coach()` and `auth_academy_id()` are the exact
--     SECURITY DEFINER helpers from migration 001 (`auth_academy_id()`
--     reads `profiles.academy_id` for `auth.uid()`; `is_admin_or_coach()`
--     checks `profiles.role IN ('admin','coach')` for `auth.uid()`) — the
--     same two functions `tactic_play_staff_write`/`training_sessions_
--     coach_all` already call, so this policy's shape is not a new pattern.
--   * A coach on a *different* academy: `academy_id = auth_academy_id()`
--     evaluates false for their session, so USING excludes every row and
--     WITH CHECK rejects every write — same mechanism already proven for
--     `tactic_plays`/`training_sessions` (migrations 015/038).
--   * A co-coach on the *same* team via `team_coaches` (not `teams.coach_id`):
--     this policy alone does not check team membership at all (deliberately
--     — see the header note above), so RLS lets any admin/coach in the
--     academy through regardless of which team they coach. The real "do you
--     coach *this* team" gate is match-plans.ts's `requireCoachTeam`
--     (app-level, same helper tactic-plays.ts already uses) — confirm by
--     reading that function, not this policy, when auditing who can write
--     a given fixture's plan.
--   * Idempotent re-apply: run this file twice against the same database —
--     `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` no-op on the
--     second run, and `DROP POLICY IF EXISTS` before `CREATE POLICY` means
--     the second run doesn't error on "policy already exists" either.

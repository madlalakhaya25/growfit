-- 064_skill_challenges.sql
--
-- Ball-skill home challenges with trophies (keepy-uppies, toe taps, wall
-- passes...). The catalogue of challenges and their bronze/silver/gold targets
-- lives in the app (web/src/lib/skill-challenges.ts); these two tables only
-- hold who was asked to do which challenge, and the scores children log.
--
-- Additive only: two new tables.
--
-- skill_challenge_assignments: a coach asks a team (or one player in it) to try
--   a challenge by a date. Coaches of the team, and admins of the academy,
--   manage them. Players of the team, and parents linked to one, read them.
--
-- skill_challenge_attempts: one logged score. Minimum data: player, challenge
--   key, a whole number, when, and who typed it in. The player writes and reads
--   their own; a linked parent reads and may log on their child's behalf (the
--   same rule as player_medical's parents_manage_child_medical in 007); coaches
--   of a team the child is in, and admins of the academy, read. Nobody edits a
--   score after the fact; a player or parent may delete one they logged.
--
-- Both have real foreign keys with ON DELETE CASCADE, so erasing a player
-- erases their attempts and personal assignments with no extra code.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS skill_challenge_assignments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id     UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  team_id        UUID        NOT NULL REFERENCES teams(id)     ON DELETE CASCADE,
  -- NULL: the whole team. Otherwise one player in it.
  player_id      UUID        REFERENCES players(id) ON DELETE CASCADE,
  challenge_key  TEXT        NOT NULL CHECK (challenge_key ~ '^[a-z0-9_]{1,40}$'),
  due_on         DATE        NOT NULL,
  created_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_challenge_assignments_team_idx
  ON skill_challenge_assignments (team_id, due_on DESC);

CREATE TABLE IF NOT EXISTS skill_challenge_attempts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  challenge_key  TEXT        NOT NULL CHECK (challenge_key ~ '^[a-z0-9_]{1,40}$'),
  value          INTEGER     NOT NULL CHECK (value BETWEEN 0 AND 2000),
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS skill_challenge_attempts_player_idx
  ON skill_challenge_attempts (player_id, challenge_key, logged_at DESC);

ALTER TABLE skill_challenge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_challenge_attempts    ENABLE ROW LEVEL SECURITY;

-- ── assignments ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "skill_assign_coach_all"  ON skill_challenge_assignments;
CREATE POLICY "skill_assign_coach_all" ON skill_challenge_assignments
  FOR ALL TO authenticated
  USING (
    academy_id = auth_academy_id()
    AND (
      auth_role() = 'admin'
      OR is_team_coach(team_id)
      OR EXISTS (SELECT 1 FROM teams t WHERE t.id = skill_challenge_assignments.team_id AND t.coach_id = auth.uid())
    )
  )
  WITH CHECK (
    academy_id = auth_academy_id()
    AND EXISTS (SELECT 1 FROM teams t WHERE t.id = skill_challenge_assignments.team_id AND t.academy_id = auth_academy_id())
    AND (
      auth_role() = 'admin'
      OR is_team_coach(team_id)
      OR EXISTS (SELECT 1 FROM teams t WHERE t.id = skill_challenge_assignments.team_id AND t.coach_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "skill_assign_player_read" ON skill_challenge_assignments;
CREATE POLICY "skill_assign_player_read" ON skill_challenge_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN players p ON p.id = tm.player_id
      WHERE tm.team_id = skill_challenge_assignments.team_id
        AND tm.active
        AND p.profile_id = auth.uid()
        AND (skill_challenge_assignments.player_id IS NULL OR skill_challenge_assignments.player_id = p.id)
    )
  );

DROP POLICY IF EXISTS "skill_assign_parent_read" ON skill_challenge_assignments;
CREATE POLICY "skill_assign_parent_read" ON skill_challenge_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN parent_player_links ppl ON ppl.player_id = tm.player_id
      WHERE tm.team_id = skill_challenge_assignments.team_id
        AND tm.active
        AND ppl.parent_id = auth.uid()
        AND (skill_challenge_assignments.player_id IS NULL OR skill_challenge_assignments.player_id = tm.player_id)
    )
  );

-- ── attempts ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "skill_attempt_player_read"   ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_player_insert" ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_player_delete" ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_parent_read"   ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_parent_insert" ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_parent_delete" ON skill_challenge_attempts;
DROP POLICY IF EXISTS "skill_attempt_staff_read"    ON skill_challenge_attempts;

CREATE POLICY "skill_attempt_player_read" ON skill_challenge_attempts
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

CREATE POLICY "skill_attempt_player_insert" ON skill_challenge_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

CREATE POLICY "skill_attempt_player_delete" ON skill_challenge_attempts
  FOR DELETE TO authenticated
  USING (
    logged_by = auth.uid()
    AND player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
  );

CREATE POLICY "skill_attempt_parent_read" ON skill_challenge_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = skill_challenge_attempts.player_id AND ppl.parent_id = auth.uid())
  );

CREATE POLICY "skill_attempt_parent_insert" ON skill_challenge_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = skill_challenge_attempts.player_id AND ppl.parent_id = auth.uid())
  );

CREATE POLICY "skill_attempt_parent_delete" ON skill_challenge_attempts
  FOR DELETE TO authenticated
  USING (
    logged_by = auth.uid()
    AND EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = skill_challenge_attempts.player_id AND ppl.parent_id = auth.uid())
  );

-- Coaches read the attempts of children in a team they coach; admins read
-- their whole academy. Staff never write a child's score.
CREATE POLICY "skill_attempt_staff_read" ON skill_challenge_attempts
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'admin' AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id()))
    OR EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.player_id = skill_challenge_attempts.player_id
        AND tm.active
        AND (t.coach_id = auth.uid() OR is_team_coach(tm.team_id))
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';

-- To verify: pg_policies should list three policies on
-- skill_challenge_assignments and seven on skill_challenge_attempts, and
-- pg_class.relrowsecurity should be true for both tables.

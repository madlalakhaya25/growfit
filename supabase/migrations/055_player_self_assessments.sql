-- 055_player_self_assessments.sql
--
-- Player self-rating (plan step 4.10). Once a term a player rates themself from
-- 1 to 5 in each of the five development categories. The coach sees where that
-- differs from their own band, as a conversation starter. It is never a score
-- and never shown to other players or to parents.
--
-- Additive only: a new table. Needs 053 (academy_terms).
--
-- Who can read: the player themself, and staff of the player's academy.
-- Who can write: the player themself only, for their own row. A coach cannot
-- write a child's answers.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS player_self_assessments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  term_id     UUID NOT NULL REFERENCES academy_terms(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('technical','tactical','physical','mental','leadership')),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, term_id, category)
);

CREATE INDEX IF NOT EXISTS player_self_assessments_player_idx ON player_self_assessments (player_id, term_id);

ALTER TABLE player_self_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_assess_player_all" ON player_self_assessments;
DROP POLICY IF EXISTS "self_assess_staff_read" ON player_self_assessments;

CREATE POLICY "self_assess_player_all" ON player_self_assessments
  FOR ALL TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()))
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND term_id IN (SELECT id FROM academy_terms WHERE academy_id = auth_academy_id())
  );

CREATE POLICY "self_assess_staff_read" ON player_self_assessments
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coach()
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
  );

COMMIT;

-- To verify after running: the table exists, RLS is on, two policies.
--   select policyname from pg_policies where tablename = 'player_self_assessments';

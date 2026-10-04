-- 062_match_minutes.sql
--
-- Minutes each child actually played in a match, saved by the coach from the
-- match-day playing-time screen (/dashboard/coach/fixtures/[id]/minutes). Feeds
-- a small "minutes this season" figure on the coach's player page, so a coach
-- can see at a glance who has had less time on the pitch.
--
-- Additive: one nullable column on match_appearances. Null means "not
-- recorded", never zero minutes; rows logged through log_match_result keep
-- working unchanged.
--
-- Policies: match_appearances already lets the academy read and staff insert
-- (migration 001). Saving minutes is an upsert, which also needs UPDATE, and
-- there has never been an UPDATE policy on this table. The new one is limited
-- to staff who coach the fixture's team (head coach or team_coaches roster,
-- the same shape as 040's multi-coach policies) or an admin of the academy.
-- Players and parents get nothing new.

ALTER TABLE match_appearances
  ADD COLUMN IF NOT EXISTS minutes_played smallint;

ALTER TABLE match_appearances
  DROP CONSTRAINT IF EXISTS match_appearances_minutes_range;
ALTER TABLE match_appearances
  ADD CONSTRAINT match_appearances_minutes_range
  CHECK (minutes_played IS NULL OR minutes_played BETWEEN 0 AND 150);

DROP POLICY IF EXISTS "appearance_staff_update" ON match_appearances;
CREATE POLICY "appearance_staff_update" ON match_appearances
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fixtures f JOIN teams t ON t.id = f.team_id
      WHERE f.id = match_appearances.fixture_id
        AND t.academy_id = auth_academy_id()
        AND (
          auth_role() = 'admin'
          OR t.coach_id = auth.uid()
          OR is_team_coach(t.id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fixtures f JOIN teams t ON t.id = f.team_id
      WHERE f.id = match_appearances.fixture_id
        AND t.academy_id = auth_academy_id()
        AND (
          auth_role() = 'admin'
          OR t.coach_id = auth.uid()
          OR is_team_coach(t.id)
        )
    )
  );

NOTIFY pgrst, 'reload schema';

-- Fixtures could be created, cancelled and result-logged, but never deleted.
-- Cancel is the right tool for a real fixture that's off (it keeps a record
-- and tells parents/players why) — but it's the wrong tool for a
-- data-entry mistake (wrong opponent, duplicate entry, wrong team) that
-- should just disappear, not sit around forever as a "cancelled" ticket
-- with an invented reason. Adds the missing DELETE policy so a real delete
-- is possible at all; app-level scoping (which team a coach actually
-- coaches, and blocking deletion of completed fixtures) lives in
-- deleteFixture() in src/app/actions/fixtures.ts, same split as every
-- other fixture policy here.
--
-- Safe to re-run.
DROP POLICY IF EXISTS "fixture_staff_delete" ON fixtures;
CREATE POLICY "fixture_staff_delete" ON fixtures FOR DELETE USING (
  is_admin_or_coach() AND
  EXISTS (SELECT 1 FROM teams t WHERE t.id = fixtures.team_id AND t.academy_id = auth_academy_id())
);

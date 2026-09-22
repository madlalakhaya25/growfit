-- More of the same bug class as migration 038: RLS predating `team_coaches`
-- (migration 019) still gates on `teams.coach_id = auth.uid()` — the single
-- original coach column — rather than "any coach on this team." 038 covered
-- training_sessions/training_drills/training_attendance; this migration
-- audits every other pre-019 policy joining through `teams t` the same way
-- and found five more, three of them read-only and easy to miss because a
-- co-coach denied by them sees an empty page rather than an error:
--
--   * `log_match_result()` — the SECURITY DEFINER RPC behind `logMatch()`
--     (the "Log result" form). A co-coach submitting Sunday's result got
--     back `{"error": "Fixture not found."}` — a confusing, wrong message
--     for a fixture that plainly exists — because the RPC's own internal
--     ownership check, not the app-level one (which is already correct),
--     rejected them.
--   * `coaches_read_medical` (player_medical) — a co-coach could not see a
--     single emergency contact for any player on a team they didn't
--     personally create in `teams.coach_id`. This is the exact data the
--     Injury & Medical Emergency Policy assumes is at hand, and the gap
--     this migration closes is a precondition for docs/BACKLOG.md 2.8's
--     offline emergency-contacts view actually working for every coach.
--   * `coaches_read_consents` and `coaches_read_documents` — a co-coach
--     saw an empty registration-document funnel (docs/BACKLOG.md 2.2) for
--     exactly the players they most needed to chase.
--   * `coaches_manage_match_attendance` (match_attendance) — a co-coach
--     could not mark who showed up to a match at all; `markMatchAttendance`
--     has no app-level check of its own, so this RLS policy is the entire
--     authorization boundary for that action.
--
-- Fix, in every case: match the OR-based pattern `get_calendar_events()`
-- (migration 037) already uses correctly — `teams.coach_id = auth.uid()`
-- (the legacy single head-coach column, still populated and still valid)
-- OR the caller appears in `team_coaches` for that team.

BEGIN;

-- Body is otherwise byte-for-byte the original from migration 001 — only
-- the ownership check in the initial guard changes. Copied rather than
-- rewritten, specifically to avoid the two ways a "quick" rewrite of this
-- function would have silently lost data: the appearances/ratings inserts
-- are upserts (`ON CONFLICT ... DO UPDATE`) guarded by
-- `jsonb_array_length(...) > 0`, not an unconditional delete-then-insert —
-- `player_ratings` in particular has one row per (fixture, player, coach),
-- so a delete-then-insert keyed on fixture alone would wipe every other
-- coach's ratings for that fixture, not just the caller's own.
CREATE OR REPLACE FUNCTION log_match_result(
  p_fixture_id     UUID,
  p_team_score     INTEGER,
  p_opponent_score INTEGER,
  p_match_notes    TEXT    DEFAULT NULL,
  p_appearances    JSONB   DEFAULT '[]',
  p_ratings        JSONB   DEFAULT '[]'
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM fixtures f
    JOIN   teams   t ON t.id = f.team_id
    WHERE  f.id       = p_fixture_id
    AND    t.active   = TRUE
    AND    (
      t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  ) THEN
    RETURN json_build_object('error', 'Fixture not found.');
  END IF;

  INSERT INTO match_results (fixture_id, team_score, opponent_score, match_notes, logged_by)
  VALUES (p_fixture_id, p_team_score, p_opponent_score, p_match_notes, auth.uid())
  ON CONFLICT (fixture_id) DO UPDATE SET
    team_score     = EXCLUDED.team_score,
    opponent_score = EXCLUDED.opponent_score,
    match_notes    = EXCLUDED.match_notes,
    logged_by      = EXCLUDED.logged_by;

  UPDATE fixtures SET status = 'completed' WHERE id = p_fixture_id;

  IF jsonb_array_length(p_appearances) > 0 THEN
    INSERT INTO match_appearances (fixture_id, player_id, played)
    SELECT p_fixture_id, (a->>'player_id')::UUID, (a->>'played')::BOOLEAN
    FROM   jsonb_array_elements(p_appearances) AS a
    ON CONFLICT (fixture_id, player_id) DO UPDATE SET played = EXCLUDED.played;
  END IF;

  IF jsonb_array_length(p_ratings) > 0 THEN
    INSERT INTO player_ratings (fixture_id, player_id, coach_id, rating, note)
    SELECT p_fixture_id,
           (r->>'player_id')::UUID,
           auth.uid(),
           (r->>'rating')::INTEGER,
           r->>'note'
    FROM   jsonb_array_elements(p_ratings) AS r
    ON CONFLICT (fixture_id, player_id, coach_id) DO UPDATE SET
      rating = EXCLUDED.rating,
      note   = EXCLUDED.note;
  END IF;

  RETURN json_build_object('success', TRUE);
END;
$$;

DROP POLICY IF EXISTS "coaches_read_medical" ON player_medical;
CREATE POLICY "coaches_read_medical" ON player_medical FOR SELECT TO authenticated
  USING (player_id IN (
    SELECT tm.player_id FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.active = true
    AND (
      t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  ));

DROP POLICY IF EXISTS "coaches_read_consents" ON player_consents;
CREATE POLICY "coaches_read_consents" ON player_consents FOR SELECT TO authenticated
  USING (player_id IN (
    SELECT tm.player_id FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.active = true
    AND (
      t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  ));

DROP POLICY IF EXISTS "coaches_read_documents" ON player_documents;
CREATE POLICY "coaches_read_documents" ON player_documents FOR SELECT TO authenticated
  USING (player_id IN (
    SELECT tm.player_id FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.active = true
    AND (
      t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  ));

DROP POLICY IF EXISTS "coaches_manage_match_attendance" ON match_attendance;
CREATE POLICY "coaches_manage_match_attendance" ON match_attendance
  FOR ALL TO authenticated
  USING (
    fixture_id IN (
      SELECT f.id FROM fixtures f
      JOIN teams t ON t.id = f.team_id
      WHERE t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  )
  WITH CHECK (
    fixture_id IN (
      SELECT f.id FROM fixtures f
      JOIN teams t ON t.id = f.team_id
      WHERE t.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  );

COMMIT;

-- Safe to re-run: the function is CREATE OR REPLACE and every policy is
-- dropped by name before being re-created.
--
-- Verify with two coach profiles in the same academy, both in
-- `team_coaches` for the same team, neither (or only one) matching that
-- team's `teams.coach_id`:
--   SELECT * FROM player_medical WHERE player_id IN (SELECT player_id FROM team_members WHERE team_id = '<shared team>');  -- as the non-head coach, should now return rows
--   SELECT log_match_result('<fixture id>', 2, 1);  -- as the non-head coach, should now succeed

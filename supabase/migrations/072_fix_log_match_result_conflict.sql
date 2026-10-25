-- 072: log_match_result could never save.
--
-- player_ratings is only unique per (fixture_id, player_id, coach_id) for
-- fixture ratings: the index from 001 is partial (WHERE fixture_id IS NOT NULL).
-- An ON CONFLICT target must repeat that predicate to match a partial index, and
-- the function from 001/040 didn't, so every call failed with 42P10 ("there is no
-- unique or exclusion constraint matching the ON CONFLICT specification") and the
-- coach saw "Something went wrong" on Log result. Postgres checks the target when
-- the statement is planned, so it failed even with no ratings given.
--
-- Found while recording the match-day demo against a local copy built from these
-- migrations. Same body as 040 apart from the WHERE on the ratings upsert.
-- CREATE OR REPLACE keeps the grants set in 071.

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
    ON CONFLICT (fixture_id, player_id, coach_id) WHERE fixture_id IS NOT NULL DO UPDATE SET
      rating = EXCLUDED.rating,
      note   = EXCLUDED.note;
  END IF;

  RETURN json_build_object('success', TRUE);
END;
$$;

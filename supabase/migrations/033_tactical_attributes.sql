-- Adds the tactical and leadership corners to the attribute model.
--
-- The model had three categories — technical, physical, mental — while
-- development milestones have had five since migration 012
-- (technical, tactical, physical, mental, leadership) and the academy coaches
-- to FIFA's 4-Corner Model. Attributes matched neither: no tactical corner at
-- all, and leadership filed under mental.
--
-- Most of the tactical corner already existed and was simply miscategorised:
-- `positioning` and `decision_making` are game understanding, not psychology.
-- That part needed no migration. These five columns round the two new corners
-- out, so each position gains only one or two new sliders rather than five.
--
-- Same shape as 013: nullable, no default, so an attribute a coach has not
-- been asked about stays NULL and is skipped by calculateOverall() and by the
-- passport rather than reading as a real assessment of 50.
--
-- Idempotent; safe to re-run.

ALTER TABLE player_attributes
  ADD COLUMN IF NOT EXISTS marking           smallint CHECK (marking           BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS pressing          smallint CHECK (pressing          BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS off_ball_movement smallint CHECK (off_ball_movement BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS game_reading      smallint CHECK (game_reading      BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS communication     smallint CHECK (communication     BETWEEN 1 AND 99);

-- Only the averaging function changes. get_public_passport() calls this and is
-- NOT redefined here — which is the point of the split made in 032. Every
-- previous migration that touched the attribute model (031, 032) rewrote the
-- whole passport function, re-copying its photo-consent enforcement by hand
-- each time. That is the one piece that must never be dropped by accident, so
-- it no longer sits in the blast radius of an attribute change.
CREATE OR REPLACE FUNCTION player_attribute_averages(p_player_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_attrs RECORD;
BEGIN
  SELECT
    round(avg(pace))::int              AS pace,
    round(avg(shooting))::int          AS shooting,
    round(avg(passing))::int           AS passing,
    round(avg(dribbling))::int         AS dribbling,
    round(avg(defending))::int         AS defending,
    round(avg(physical))::int          AS physical,
    round(avg(ball_control))::int      AS ball_control,
    round(avg(crossing))::int          AS crossing,
    round(avg(heading))::int           AS heading,
    round(avg(tackling))::int          AS tackling,
    round(avg(finishing))::int         AS finishing,
    round(avg(first_touch))::int       AS first_touch,
    round(avg(stamina))::int           AS stamina,
    round(avg(agility))::int           AS agility,
    round(avg(jumping))::int           AS jumping,
    round(avg(strength))::int          AS strength,
    round(avg(positioning))::int       AS positioning,
    round(avg(decision_making))::int   AS decision_making,
    round(avg(composure))::int         AS composure,
    round(avg(work_rate))::int         AS work_rate,
    round(avg(leadership))::int        AS leadership,
    round(avg(shot_stopping))::int     AS shot_stopping,
    round(avg(reflexes))::int          AS reflexes,
    round(avg(distribution))::int      AS distribution,
    round(avg(handling))::int          AS handling,
    round(avg(marking))::int           AS marking,
    round(avg(pressing))::int          AS pressing,
    round(avg(off_ball_movement))::int AS off_ball_movement,
    round(avg(game_reading))::int      AS game_reading,
    round(avg(communication))::int     AS communication
  INTO v_attrs
  FROM player_attributes
  WHERE player_id = p_player_id;

  RETURN row_to_json(v_attrs);
END;
$$;

-- Only ever called from inside get_public_passport(), which is SECURITY
-- DEFINER and so passes this permission check as its owner. Without this,
-- CREATE FUNCTION's default grant to PUBLIC would let anyone call it directly
-- with a player UUID and read their attributes without a share token.
REVOKE EXECUTE ON FUNCTION player_attribute_averages(UUID) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

-- Verification (run separately; should return 30 rows):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'player_attributes'
--     AND column_name NOT IN ('id','player_id','coach_id','notes','assessed_at')
--   ORDER BY column_name;
--
-- And confirm 032's protections are untouched (they should be — this file no
-- longer redefines get_public_passport at all): a player with photo_consent
-- FALSE still gets photo_url NULL; no date_of_birth and no ratings[].note
-- anywhere in the returned JSON.

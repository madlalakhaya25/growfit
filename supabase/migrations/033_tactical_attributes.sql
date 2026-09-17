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

-- The passport averages every attribute a coach has rated. Without this the
-- five new ones would be assessed by coaches and silently missing from the
-- public page.
--
-- Carries migration 032 forward byte-for-byte apart from the five added
-- averages: the photo-consent CASE (originally 023), the derived age in place
-- of raw date_of_birth, the dropped coach notes and internal UUID, and the
-- NULL return for an unknown token. Re-read 032's header before editing this.
CREATE OR REPLACE FUNCTION get_public_passport(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player players%ROWTYPE;
  v_attrs  RECORD;
  v_photo_consent BOOLEAN;
  v_academy_name TEXT;
BEGIN
  SELECT * INTO v_player
  FROM players
  WHERE share_token = lower(trim(p_share_token)) AND active = TRUE;

  IF v_player.id IS NULL THEN
    RETURN NULL::json;
  END IF;

  SELECT photo_consent INTO v_photo_consent
  FROM player_consents
  WHERE player_id = v_player.id
    AND season = extract(year FROM now())::text;

  SELECT name INTO v_academy_name FROM academies WHERE id = v_player.academy_id;

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
  WHERE player_id = v_player.id;

  RETURN json_build_object(
    'full_name',      v_player.full_name,
    'position',       v_player.position,
    'secondary_pos',  v_player.secondary_pos,
    'preferred_foot', v_player.preferred_foot,
    'age',            CASE
                        WHEN v_player.date_of_birth IS NULL THEN NULL
                        ELSE date_part('year', age(v_player.date_of_birth))::int
                      END,
    'photo_url',      CASE WHEN v_photo_consent IS TRUE THEN v_player.photo_url ELSE NULL END,
    'share_token',    v_player.share_token,
    'academy_name',   v_academy_name,
    'attributes',     row_to_json(v_attrs),
    'ratings', (
      SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
      FROM (
        SELECT pr.rating, pr.created_at,
               f.opponent, f.fixture_date
        FROM player_ratings pr
        LEFT JOIN fixtures f ON f.id = pr.fixture_id
        WHERE pr.player_id = v_player.id
        ORDER BY pr.created_at DESC
      ) r
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Verification (run separately; should return 30 rows):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'player_attributes'
--     AND column_name NOT IN ('id','player_id','coach_id','notes','assessed_at')
--   ORDER BY column_name;
--
-- And confirm 032's protections survived this CREATE OR REPLACE:
--   a player with photo_consent FALSE still gets photo_url NULL; no
--   date_of_birth and no ratings[].note anywhere in the returned JSON.

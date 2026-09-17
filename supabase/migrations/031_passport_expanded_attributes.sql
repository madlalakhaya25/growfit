-- The public passport showed a fixed six attributes (pace, shooting, passing,
-- dribbling, defending, physical) because that is all get_public_passport()
-- ever returned. Since migration 013 a coach assesses a position-specific set
-- instead, which for a goalkeeper overlaps those six in exactly one place
-- (pace) — so a keeper's public passport showed five attributes nobody had
-- rated and none of the goalkeeping ones.
--
-- Widens the averaged attribute set to all 25. avg() over an all-NULL column
-- stays NULL, so an attribute no coach rated is absent from the JSON and the
-- passport page filters it out rather than rendering a phantom value.
--
-- Carries forward migration 023's photo-consent enforcement unchanged: this
-- SECURITY DEFINER function is still the only path by which a player photo
-- reaches an anonymous visitor, and consent still defaults to withheld.
CREATE OR REPLACE FUNCTION get_public_passport(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player players%ROWTYPE;
  v_attrs  RECORD;
  v_photo_consent BOOLEAN;
BEGIN
  SELECT * INTO v_player
  FROM players
  WHERE share_token = lower(trim(p_share_token)) AND active = TRUE;

  IF v_player.id IS NULL THEN
    RETURN json_build_object('error', 'Player not found.');
  END IF;

  SELECT photo_consent INTO v_photo_consent
  FROM player_consents
  WHERE player_id = v_player.id
    AND season = extract(year FROM now())::text;

  SELECT
    round(avg(pace))::int            AS pace,
    round(avg(shooting))::int        AS shooting,
    round(avg(passing))::int         AS passing,
    round(avg(dribbling))::int       AS dribbling,
    round(avg(defending))::int       AS defending,
    round(avg(physical))::int        AS physical,
    round(avg(ball_control))::int    AS ball_control,
    round(avg(crossing))::int        AS crossing,
    round(avg(heading))::int         AS heading,
    round(avg(tackling))::int        AS tackling,
    round(avg(finishing))::int       AS finishing,
    round(avg(first_touch))::int     AS first_touch,
    round(avg(stamina))::int         AS stamina,
    round(avg(agility))::int         AS agility,
    round(avg(jumping))::int         AS jumping,
    round(avg(strength))::int        AS strength,
    round(avg(positioning))::int     AS positioning,
    round(avg(decision_making))::int AS decision_making,
    round(avg(composure))::int       AS composure,
    round(avg(work_rate))::int       AS work_rate,
    round(avg(leadership))::int      AS leadership,
    round(avg(shot_stopping))::int   AS shot_stopping,
    round(avg(reflexes))::int        AS reflexes,
    round(avg(distribution))::int    AS distribution,
    round(avg(handling))::int        AS handling
  INTO v_attrs
  FROM player_attributes
  WHERE player_id = v_player.id;

  RETURN json_build_object(
    'id',             v_player.id,
    'full_name',      v_player.full_name,
    'position',       v_player.position,
    'secondary_pos',  v_player.secondary_pos,
    'preferred_foot', v_player.preferred_foot,
    'date_of_birth',  v_player.date_of_birth,
    'photo_url',      CASE WHEN v_photo_consent IS TRUE THEN v_player.photo_url ELSE NULL END,
    'share_token',    v_player.share_token,
    'attributes',     row_to_json(v_attrs),
    'ratings', (
      SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
      FROM (
        SELECT pr.rating, pr.note, pr.created_at,
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

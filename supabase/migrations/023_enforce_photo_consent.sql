-- Photo consent was captured (player_consents.photo_consent) and exported in
-- admin reports, but nothing actually checked it before rendering a photo —
-- including the public, unauthenticated passport page. A parent unticking
-- "photo consent" had no effect anywhere.
--
-- Enforced here, inside the SECURITY DEFINER function itself, rather than in
-- the page/route that calls it — this is the only path a photo reaches an
-- anonymous visitor, so it's the one place the check can't be forgotten or
-- bypassed by a future caller of the same RPC. Consent is looked up for the
-- current season and defaults to withheld (matches the column's own
-- DEFAULT FALSE) when no consent row exists yet — missing consent is not
-- implicit permission.
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
    round(avg(pace))::int      AS pace,
    round(avg(shooting))::int  AS shooting,
    round(avg(passing))::int   AS passing,
    round(avg(dribbling))::int AS dribbling,
    round(avg(defending))::int AS defending,
    round(avg(physical))::int  AS physical
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

-- 014_claim_backfill_academy.sql
--
-- Players can now finish onboarding without a club join code (they land in a
-- "waiting to be added" state). When the coach later adds them and hands over a
-- share token, claiming it must also link their profile to the academy — the
-- original claim_player_profile only set players.profile_id and left
-- profiles.academy_id NULL, which would trap the player behind the dashboard's
-- academy_id guard. COALESCE keeps any existing academy_id (multi-club safe).

CREATE OR REPLACE FUNCTION claim_player_profile(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player_id   UUID;
  v_player_name TEXT;
  v_academy_id  UUID;
BEGIN
  SELECT id, full_name, academy_id INTO v_player_id, v_player_name, v_academy_id
  FROM   players
  WHERE  share_token = lower(trim(p_share_token))
  AND    profile_id  IS NULL
  AND    active      = TRUE;

  IF v_player_id IS NULL THEN
    RETURN json_build_object('error', 'Token not found or already claimed.');
  END IF;

  UPDATE players SET profile_id = auth.uid()
  WHERE  id = v_player_id AND profile_id IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Profile was just claimed by someone else.');
  END IF;

  -- Link the claimer to the academy if they signed up without a club code.
  UPDATE profiles
  SET    academy_id = COALESCE(academy_id, v_academy_id)
  WHERE  id = auth.uid();

  RETURN json_build_object('success', TRUE, 'name', v_player_name, 'player_id', v_player_id);
END;
$$;

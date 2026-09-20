-- 020_player_self_update.sql
--
-- A player's own "My Registration Numbers" form has been silently broken since
-- it shipped: the only player-facing UPDATE policy on players (player_self_claim)
-- applies exclusively while profile_id IS NULL — the one-time claim itself.
-- Once claimed, no policy lets a player touch their own row again, so every
-- edit after that point is dropped by RLS with no error (the write action does
-- not check affected row count), and the form reports success while saving
-- nothing.
--
-- A SECURITY DEFINER function, rather than a broader UPDATE policy, keeps this
-- narrow: it can only ever touch mysafa_number and id_number on the caller's
-- own row, regardless of what a raw UPDATE statement might otherwise attempt.
-- Everything else — name, DOB, position, photo — stays staff-controlled.

CREATE OR REPLACE FUNCTION update_own_registration_numbers(
  p_mysafa_number TEXT,
  p_id_number     TEXT
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE players
  SET    mysafa_number = NULLIF(trim(p_mysafa_number), ''),
         id_number      = NULLIF(trim(p_id_number), '')
  WHERE  profile_id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No linked player profile found for your account.');
  END IF;

  RETURN json_build_object('success', TRUE);
END;
$$;

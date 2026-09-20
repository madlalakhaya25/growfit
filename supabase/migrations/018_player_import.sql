-- 018_player_import.sql
--
-- Supports bulk player creation from SAFA/LFA registration PDFs, and lets a
-- player claim the record that was created for them when they later sign up.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS fifa_number TEXT;

-- Registration numbers are how a player is matched to their pre-created record.
CREATE INDEX IF NOT EXISTS players_mysafa_idx ON players (academy_id, mysafa_number);
CREATE INDEX IF NOT EXISTS players_idnum_idx  ON players (academy_id, id_number);

-- ─────────────────────────────────────────────────────────────
-- Claim a pre-created player record by registration number
-- ─────────────────────────────────────────────────────────────
-- A player imported from a registration PDF has no share token in their hands,
-- so they cannot use claim_player_profile. This lets them claim their own
-- record with a number from their registration card plus their date of birth.
--
-- Date of birth is required as a second factor: a MySAFA number alone is
-- guessable/knowable by others, and these are children's records.

CREATE OR REPLACE FUNCTION claim_player_by_registration(
  p_number        TEXT,
  p_date_of_birth DATE
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player_id   UUID;
  v_player_name TEXT;
  v_academy_id  UUID;
  v_needle      TEXT := upper(regexp_replace(coalesce(p_number, ''), '\s', '', 'g'));
BEGIN
  IF v_needle = '' OR p_date_of_birth IS NULL THEN
    RETURN json_build_object('error', 'Enter your registration number and date of birth.');
  END IF;

  SELECT id, full_name, academy_id
  INTO   v_player_id, v_player_name, v_academy_id
  FROM   players
  WHERE  profile_id IS NULL
  AND    active = TRUE
  AND    date_of_birth = p_date_of_birth
  AND    (
           upper(regexp_replace(coalesce(mysafa_number, ''), '\s', '', 'g')) = v_needle
        OR upper(regexp_replace(coalesce(id_number, ''),    '\s', '', 'g')) = v_needle
        OR upper(regexp_replace(coalesce(fifa_number, ''),  '\s', '', 'g')) = v_needle
         )
  LIMIT  1;

  IF v_player_id IS NULL THEN
    RETURN json_build_object('error', 'No unclaimed player found with that number and date of birth. Check with your coach.');
  END IF;

  UPDATE players SET profile_id = auth.uid()
  WHERE  id = v_player_id AND profile_id IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Profile was just claimed by someone else.');
  END IF;

  UPDATE profiles
  SET    academy_id = COALESCE(academy_id, v_academy_id)
  WHERE  id = auth.uid();

  RETURN json_build_object('success', TRUE, 'name', v_player_name, 'player_id', v_player_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Widen the position constraint to the roles the app actually offers
-- ─────────────────────────────────────────────────────────────
-- players.position still only accepted the five original values, while the app
-- has long offered specific roles (gk, cb, lb, cdm, …). Saving any of those
-- failed the check constraint. The legacy five are kept so existing rows stay
-- valid.

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_position_check;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_secondary_pos_check;

ALTER TABLE players ADD CONSTRAINT players_position_check
  CHECK (position IS NULL OR position IN (
    'gk','cb','sw','lb','rb','lwb','rwb','cdm','cm','lm','rm','cam',
    'lw','rw','ss','cf','st',
    'goalkeeper','defender','midfielder','winger','striker'
  ));

ALTER TABLE players ADD CONSTRAINT players_secondary_pos_check
  CHECK (secondary_pos IS NULL OR secondary_pos IN (
    'gk','cb','sw','lb','rb','lwb','rwb','cdm','cm','lm','rm','cam',
    'lw','rw','ss','cf','st',
    'goalkeeper','defender','midfielder','winger','striker'
  ));

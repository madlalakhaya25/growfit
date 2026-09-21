-- SAFEGUARDING: `claim_player_profile` accepted a printed/QR credential from
-- ANY signed-in account, with no second factor and no role check.
--
-- `share_token` is `players.share_token` — the same public passport URL
-- segment printed on every PDF player card and encoded in its QR (see
-- migration 032's note on this same value). `claim_player_profile` let any
-- authenticated account attach itself to the matching unclaimed player row
-- using nothing but that token: no check that the caller was even a player
-- account (a coach or parent account could claim a child's row), no second
-- factor, and no throttle. Migration 032 already retired `share_token` as a
-- credential for linking a *parent* to a child for exactly this reason; this
-- closes the same hole one function over, on the player's own claim path.
--
-- `claim_player_by_registration` (018_player_import.sql) already set the
-- precedent for this exact class of credential: a knowable/printed
-- registration number is only accepted alongside the player's date of birth
-- as a second factor. This migration brings `claim_player_profile` in line
-- with that same rule, adds the role check, and adds the same per-account
-- throttle `redeem_parent_link_code` uses (032) — this RPC is authenticated,
-- so the actor is known and the limit can live in the database.
--
-- Idempotent; safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Throttle claim attempts — same shape as parent_link_attempts (032).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_claim_attempts (
  actor_id     UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  attempts     INT         NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_claim_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON player_claim_attempts FROM authenticated, anon;

CREATE OR REPLACE FUNCTION record_player_claim_failure()
RETURNS VOID LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO player_claim_attempts (actor_id, attempts, window_start)
  VALUES (auth.uid(), 1, NOW())
  ON CONFLICT (actor_id) DO UPDATE SET attempts = player_claim_attempts.attempts + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_player_claim_failure() FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────
-- 2. Re-verify the claim: share token + date of birth, player accounts only.
-- ─────────────────────────────────────────────────────────────
-- A player with no date of birth on file cannot be claimed through this path
-- (NULL never equals p_date_of_birth) — same limitation
-- claim_player_by_registration already accepts for the identical reason. A
-- coach or admin needs to link that player's account directly instead.

CREATE OR REPLACE FUNCTION claim_player_profile(
  p_share_token   TEXT,
  p_date_of_birth DATE
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player_id   UUID;
  v_player_name TEXT;
  v_academy_id  UUID;
  v_role        TEXT;
  v_attempts    INT;
  v_window      TIMESTAMPTZ;
  -- ONE message for every failure mode. Distinguishing "wrong token" from
  -- "wrong date of birth" would tell someone who only has the printed card
  -- whether they merely need to guess a date of birth to get in.
  c_generic CONSTANT TEXT :=
    'No unclaimed player found with that token and date of birth. Check with your coach.';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not signed in.');
  END IF;

  -- Throttle: 5 failures per 15-minute window, per account. Same limits as
  -- redeem_parent_link_code (032).
  SELECT attempts, window_start INTO v_attempts, v_window
  FROM player_claim_attempts WHERE actor_id = auth.uid();

  IF v_window IS NOT NULL AND v_window < NOW() - INTERVAL '15 minutes' THEN
    UPDATE player_claim_attempts SET attempts = 0, window_start = NOW() WHERE actor_id = auth.uid();
    v_attempts := 0;
  END IF;

  IF COALESCE(v_attempts, 0) >= 5 THEN
    RETURN json_build_object('error', 'Too many attempts. Wait 15 minutes and try again.');
  END IF;

  IF p_share_token IS NULL OR trim(p_share_token) = '' OR p_date_of_birth IS NULL THEN
    PERFORM record_player_claim_failure();
    RETURN json_build_object('error', c_generic);
  END IF;

  -- Never let a non-player account attach itself to a player row through
  -- this path. A coach, parent or admin claiming here is an error, not a
  -- role change — same reasoning as redeem_parent_link_code's role check.
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'player' THEN
    RETURN json_build_object('error', 'Only a player account can claim a player profile.');
  END IF;

  SELECT id, full_name, academy_id
  INTO   v_player_id, v_player_name, v_academy_id
  FROM   players
  WHERE  share_token    = lower(trim(p_share_token))
  AND    profile_id     IS NULL
  AND    active         = TRUE
  AND    date_of_birth  = p_date_of_birth;

  IF v_player_id IS NULL THEN
    PERFORM record_player_claim_failure();
    RETURN json_build_object('error', c_generic);
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

  DELETE FROM player_claim_attempts WHERE actor_id = auth.uid();

  RETURN json_build_object('success', TRUE, 'name', v_player_name, 'player_id', v_player_id);
END;
$$;

-- Authenticated only — never anon. `claim_player_profile` had no explicit
-- grant before this migration, which left it on Postgres' default EXECUTE-
-- to-PUBLIC (every role, anon included).
REVOKE EXECUTE ON FUNCTION claim_player_profile(TEXT, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION claim_player_profile(TEXT, DATE) TO authenticated;

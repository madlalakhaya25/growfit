-- 027_access_codes.sql
--
-- Fixes a verified chain of defects that makes it likely for a coach or
-- admin handed a real access code to end up in an unrecoverable account:
--
-- 1. handle_new_user() hardcoded role='player' and ignored the role chosen
--    at signup, so with email confirmation on (Supabase's default) every
--    new coach/parent/admin was silently demoted to 'player' the moment
--    their account was actually created.
-- 2. There was no INSERT policy on `profiles` anywhere, so the one recovery
--    screen (/auth/role) — which does an upsert — failed outright with a
--    raw RLS error.
-- 3. `team_member_staff_write` only allows admin/coach to insert
--    team_members, so a plain player redeeming a squad invite code via a
--    direct client insert was rejected by RLS regardless of anything else.
-- 4. profile_update_own had no WITH CHECK, so any authenticated user could
--    PATCH their own row to role='admin' with no code at all.
--
-- This migration centralises "what does this code do" behind one
-- SECURITY DEFINER RPC (redeem_access_code) so redemption always runs with
-- elevated privileges, always normalises the code the same way, and always
-- decides what kind of code it is from the code itself rather than trusting
-- the caller.

-- ── 1. Respect the role chosen at signup ─────────────────────────
-- Never 'admin' here — an admin role must come from register_academy(),
-- which promotes the caller after creating a fresh academy. Honouring
-- role='admin' straight out of signup metadata (which any client can set)
-- would let anyone self-promote with no academy and no code at all.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  IF v_role NOT IN ('coach', 'player', 'parent') THEN
    v_role := 'player';
  END IF;
  INSERT INTO profiles (id, role, full_name)
  VALUES (NEW.id, v_role, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 2. Let the recovery screen actually insert ───────────────────
-- handle_new_user() already creates the row (SECURITY DEFINER, bypasses
-- RLS), so this is a safety net for any future upsert-shaped write, not a
-- path that should ordinarily fire.
DROP POLICY IF EXISTS "profile_insert_own" ON profiles;
CREATE POLICY "profile_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid() AND role <> 'admin');

-- ── 3. Close the direct-PATCH privilege escalation ───────────────
-- Column-level revoke, not a WITH CHECK: Postgres RLS policies have no way
-- to compare the new row to the old one (no OLD reference), so the robust
-- fix is to stop the `authenticated` role from touching these two columns
-- at all. Every legitimate role/academy change already goes through a
-- SECURITY DEFINER function below, which runs as the function owner and is
-- therefore unaffected by this revoke.
REVOKE UPDATE (role, academy_id) ON profiles FROM authenticated;

-- ── 4. Collision retries the existing rotate functions were missing ──
CREATE OR REPLACE FUNCTION reset_academy_join_code()
RETURNS TEXT LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_new_code   TEXT;
  v_academy_id UUID;
  v_attempts   INT := 0;
BEGIN
  SELECT academy_id INTO v_academy_id FROM profiles WHERE id = auth.uid() AND role = 'admin';
  IF v_academy_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  LOOP
    v_attempts := v_attempts + 1;
    v_new_code := upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 6));
    BEGIN
      UPDATE academies SET join_code = v_new_code WHERE id = v_academy_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN v_new_code;
END;
$$;

CREATE OR REPLACE FUNCTION reset_team_coach_code(p_team_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code     TEXT;
  v_attempts INT := 0;
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'admin' THEN
    RETURN json_build_object('error', 'Only an admin can reset a coach code.');
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    BEGIN
      UPDATE teams SET coach_code = v_code
      WHERE id = p_team_id AND academy_id = auth_academy_id();
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Team not found in your academy.');
  END IF;

  RETURN json_build_object('success', TRUE, 'coach_code', v_code);
END;
$$;

-- ── 5. Close the two-concurrent-coaches head-coach race ──────────
CREATE UNIQUE INDEX IF NOT EXISTS team_coaches_one_head_per_team
  ON team_coaches (team_id) WHERE is_head;

-- ── 6. peek_access_code — validity check before an account exists ────
-- Anonymous-safe: registration needs to validate a code *before* calling
-- signUp(), or a coach given the wrong code ends up with an orphaned,
-- unrecoverable auth.users row (signUp succeeded, code check failed after).
-- Returns only whether it's valid and what kind it is — never the raw code
-- or any id, so it isn't itself a route to enumerate the academies table.
CREATE OR REPLACE FUNCTION peek_access_code(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_needle TEXT := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_kind   TEXT;
  v_label  TEXT;
BEGIN
  IF v_needle = '' THEN RETURN json_build_object('valid', FALSE); END IF;

  SELECT 'team_coach', name INTO v_kind, v_label FROM teams WHERE upper(coach_code) = v_needle AND active = TRUE;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind, 'label', v_label); END IF;

  SELECT 'team_player', name INTO v_kind, v_label FROM teams WHERE upper(invite_code) = v_needle AND active = TRUE;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind, 'label', v_label); END IF;

  SELECT 'academy', name INTO v_kind, v_label FROM academies WHERE upper(join_code) = v_needle;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind, 'label', v_label); END IF;

  RETURN json_build_object('valid', FALSE);
END;
$$;

-- ── 7. redeem_access_code — the one place a code is ever applied ─────
-- Works out what kind of code it was given from the code itself (coach code
-- → team_coaches, invite code → team_members, join code → academy_id) so
-- every caller (registration, the /auth/role recovery screen, /join/[code])
-- shares one implementation instead of three that can drift apart.
--
-- p_role is only ever used to grant an *initial* role — becoming a coach by
-- redeeming a coach code, or setting the role chosen on /auth/role the first
-- time an account gets an academy. It can never set 'admin' (see above) and
-- never overwrites a role or academy_id the account already has.
CREATE OR REPLACE FUNCTION redeem_access_code(p_code TEXT, p_role TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_needle    TEXT := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_profile   RECORD;
  v_team      RECORD;
  v_player    RECORD;
  v_existing  RECORD;
  v_academy   RECORD;
  v_coach_res JSON;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_needle = '' THEN
    RETURN json_build_object('error', 'Enter a code to continue.');
  END IF;
  IF p_role = 'admin' THEN
    RETURN json_build_object('error', 'Admin accounts are created by registering a new club, not with a code.');
  END IF;

  SELECT id, role, academy_id INTO v_profile FROM profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN
    RETURN json_build_object('error', 'Profile not found.');
  END IF;

  -- ── Team coach code ──────────────────────────────────────────
  SELECT id INTO v_team FROM teams WHERE upper(coach_code) = v_needle AND active = TRUE;
  IF v_team.id IS NOT NULL THEN
    IF p_role IS NOT NULL AND p_role <> 'coach' THEN
      RETURN json_build_object('error', 'That code is a coach code for a team — choose Coach to use it.');
    END IF;
    IF v_profile.role NOT IN ('coach', 'admin') THEN
      IF p_role = 'coach' THEN
        UPDATE profiles SET role = 'coach' WHERE id = auth.uid();
      ELSE
        RETURN json_build_object('error', 'Only a coach can claim a team. Choose Coach to continue.');
      END IF;
    END IF;
    v_coach_res := claim_team_by_coach_code(p_code);
    IF (v_coach_res->>'error') IS NOT NULL THEN
      RETURN v_coach_res;
    END IF;
    RETURN json_build_object(
      'success', TRUE, 'kind', 'team_coach',
      'team_name', v_coach_res->>'team_name',
      'already', COALESCE((v_coach_res->>'already')::boolean, FALSE),
      'is_head', COALESCE((v_coach_res->>'is_head')::boolean, FALSE)
    );
  END IF;

  -- ── Player invite code ───────────────────────────────────────
  SELECT t.id, t.name, t.academy_id INTO v_team
  FROM teams t WHERE upper(t.invite_code) = v_needle AND t.active = TRUE;
  IF v_team.id IS NOT NULL THEN
    IF v_profile.academy_id IS NOT NULL AND v_profile.academy_id <> v_team.academy_id THEN
      RETURN json_build_object('error', 'That team belongs to a different academy.');
    END IF;
    SELECT id INTO v_player FROM players WHERE profile_id = auth.uid() AND active = TRUE;
    IF v_player.id IS NULL THEN
      RETURN json_build_object('error', 'No player profile found. Ask your coach to create your profile first.');
    END IF;
    SELECT team_id, active INTO v_existing
    FROM team_members WHERE team_id = v_team.id AND player_id = v_player.id;
    IF v_existing.team_id IS NOT NULL AND v_existing.active THEN
      RETURN json_build_object('success', TRUE, 'kind', 'team_player', 'team_name', v_team.name, 'already', TRUE);
    ELSIF v_existing.team_id IS NOT NULL THEN
      UPDATE team_members SET active = TRUE WHERE team_id = v_team.id AND player_id = v_player.id;
    ELSE
      INSERT INTO team_members (team_id, player_id) VALUES (v_team.id, v_player.id);
    END IF;
    UPDATE profiles SET academy_id = COALESCE(academy_id, v_team.academy_id) WHERE id = auth.uid();
    RETURN json_build_object('success', TRUE, 'kind', 'team_player', 'team_name', v_team.name);
  END IF;

  -- ── Academy join code ────────────────────────────────────────
  SELECT id, name INTO v_academy FROM academies WHERE upper(join_code) = v_needle;
  IF v_academy.id IS NOT NULL THEN
    IF v_profile.academy_id IS NOT NULL AND v_profile.academy_id <> v_academy.id THEN
      RETURN json_build_object('error', 'Your account is already linked to a different academy.');
    END IF;
    UPDATE profiles
    SET academy_id = COALESCE(academy_id, v_academy.id),
        -- Only ever sets the role on first attach to an academy — never
        -- overwrites a role the account already had one before this call.
        role = CASE WHEN academy_id IS NULL AND p_role IS NOT NULL THEN p_role ELSE role END
    WHERE id = auth.uid();
    RETURN json_build_object('success', TRUE, 'kind', 'academy', 'academy_name', v_academy.name);
  END IF;

  RETURN json_build_object('error', 'No club or team found with that code. Check it with your admin.');
END;
$$;

-- ── 8. Lock down who can call what ────────────────────────────────
-- find_academy_by_join_code is superseded by peek_access_code /
-- redeem_access_code on every client path; it was callable by anon with no
-- rate limit and no reason to be. Kept (not dropped) since it's still a
-- convenient direct lookup for any future server-side use.
REVOKE EXECUTE ON FUNCTION find_academy_by_join_code(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION find_academy_by_join_code(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION peek_access_code(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION peek_access_code(TEXT) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION redeem_access_code(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION redeem_access_code(TEXT, TEXT) TO authenticated;

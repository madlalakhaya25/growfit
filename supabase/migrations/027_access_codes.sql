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
--
-- Revised after a second-pass review caught three defects in the first
-- version of this file, none of which had shipped anywhere (nothing in
-- this environment applies migrations — see web/CLAUDE.md), so fixed here
-- in place rather than layered on as a follow-up patch to code no one had
-- run yet:
--
-- A. The original #4 fix — REVOKE UPDATE (role, academy_id) ON profiles
--    FROM authenticated — does nothing. Supabase's bootstrap grants
--    table-level UPDATE on every public table to `authenticated`, and in
--    PostgreSQL a column-level REVOKE does not subtract from a table-level
--    grant that already covers that column — the two are independent ACL
--    entries, and a role with *either* may update the column. The escalation
--    this file's own header claims is fixed was not fixed. See "3. Close
--    the direct-PATCH privilege escalation" below for the actual fix.
-- B. handle_new_user() honoured role='coach' straight from signup metadata,
--    which any client can set with no code presented at all, and the
--    academy-join-code branch of redeem_access_code() would then happily
--    set that role on attach — so a parent handed the ordinary academy
--    join code (given to every parent and player) could register picking
--    "Coach" and land with academy-wide coach privileges, no coach code
--    ever checked. `teams.coach_code` (019) existing as a *separate* code
--    from the academy/player ones was already a deliberate design
--    decision recorded in that migration's own comments; this closed the
--    hole that bypassed it.
-- C. joinByInviteCode() (web/src/app/actions/squad.ts) calls this RPC
--    expecting a player invite code specifically, but the RPC mutates on
--    the *first* matching branch regardless of what the caller expected —
--    so a coach/academy code pasted into the join-a-squad flow got
--    silently applied (attached the caller to that academy, or claimed a
--    coach seat) before the action even got to check the returned `kind`
--    and report "that's not a squad code". p_expect_kind below fixes this
--    by checking before any write, not after.

-- ── 1. Respect the role chosen at signup ─────────────────────────
-- Never 'admin' (see above — that only ever comes from register_academy())
-- and never 'coach' (see B above — a coach seat is only ever granted by
-- claim_team_by_coach_code(), reached through redeem_access_code()'s own
-- team-coach-code branch below, which actually validates a code).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
  IF v_role NOT IN ('player', 'parent') THEN
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
-- The actual, working fix (see note A above): remove `authenticated`'s
-- table-level UPDATE grant on profiles entirely, then grant it back only
-- for the columns a client legitimately edits (settings.tsx forms —
-- see src/app/actions/profile.ts). role and academy_id are deliberately
-- not in that list. Every legitimate role/academy change goes through a
-- SECURITY DEFINER function below, which runs as the function owner and
-- is checked against Postgres privileges independently of this grant —
-- it is unaffected by revoking the table-level grant from `authenticated`.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT  UPDATE (full_name, phone, bio, coaching_role) ON profiles TO authenticated;

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
  v_rows     INT;
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
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN RAISE; END IF;
    END;
  END LOOP;

  -- GET DIAGNOSTICS captured directly after the UPDATE, rather than relying
  -- on FOUND surviving the loop/EXIT — safer if this function grows another
  -- statement between the update and this check later.
  IF v_rows = 0 THEN
    RETURN json_build_object('error', 'Team not found in your academy.');
  END IF;

  RETURN json_build_object('success', TRUE, 'coach_code', v_code);
END;
$$;

-- ── 5. Close the two-concurrent-coaches head-coach race ──────────
-- Dedupe first: this index creation fails outright if any team somehow
-- already has two is_head rows (shouldn't happen given 019's own logic,
-- but CREATE UNIQUE INDEX gives no partial-progress on conflict, so a
-- migration run against real data would abort here with no rows fixed).
UPDATE team_coaches tc SET is_head = FALSE
WHERE tc.is_head AND tc.added_at > (
  SELECT MIN(added_at) FROM team_coaches tc2 WHERE tc2.team_id = tc.team_id AND tc2.is_head
);

CREATE UNIQUE INDEX IF NOT EXISTS team_coaches_one_head_per_team
  ON team_coaches (team_id) WHERE is_head;

-- remove_team_coach (019_team_coach_code.sql) unconditionally promoted the
-- longest-tenured remaining coach to head, even when the coach removed
-- wasn't the head — harmless before this migration (a team could silently
-- end up with two heads), but a hard failure now that the index above
-- exists. Only promote when the team is actually left without one.
CREATE OR REPLACE FUNCTION remove_team_coach(p_team_id UUID, p_coach_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_next UUID;
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'admin' THEN
    RETURN json_build_object('error', 'Only an admin can remove a coach.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND academy_id = auth_academy_id()) THEN
    RETURN json_build_object('error', 'Team not found in your academy.');
  END IF;

  DELETE FROM team_coaches WHERE team_id = p_team_id AND coach_id = p_coach_id;

  IF NOT EXISTS (SELECT 1 FROM team_coaches WHERE team_id = p_team_id AND is_head) THEN
    SELECT coach_id INTO v_next
    FROM   team_coaches WHERE team_id = p_team_id
    ORDER  BY added_at ASC LIMIT 1;

    IF v_next IS NOT NULL THEN
      UPDATE team_coaches SET is_head = TRUE WHERE team_id = p_team_id AND coach_id = v_next;
      UPDATE teams SET coach_id = v_next WHERE id = p_team_id;
    END IF;
  END IF;

  RETURN json_build_object('success', TRUE);
END;
$$;

-- ── 6. peek_access_code — validity check before an account exists ────
-- Anonymous-safe: registration needs to validate a code *before* calling
-- signUp(), or a coach given the wrong code ends up with an orphaned,
-- unrecoverable auth.users row (signUp succeeded, code check failed after).
-- Returns only whether it's valid and what kind it is — not the club/team
-- name. An earlier version of this function also returned that name, on
-- the reasoning that it exposed no id; it still handed anon an unlimited,
-- 6-hex-char code→name oracle (a hit on a team_coach code told a caller a
-- real coach seat exists for that code, by name) — dropped rather than
-- rate-limited, since rate-limiting an anon RPC needs infrastructure
-- (an attempts table keyed by IP or a shared store) this environment can't
-- add. The client shows only "this code is valid" now, not what it's for.
CREATE OR REPLACE FUNCTION peek_access_code(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_needle TEXT := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_kind   TEXT;
BEGIN
  IF v_needle = '' THEN RETURN json_build_object('valid', FALSE); END IF;

  SELECT 'team_coach' INTO v_kind FROM teams WHERE upper(coach_code) = v_needle AND active = TRUE;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind); END IF;

  SELECT 'team_player' INTO v_kind FROM teams WHERE upper(invite_code) = v_needle AND active = TRUE;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind); END IF;

  SELECT 'academy' INTO v_kind FROM academies WHERE upper(join_code) = v_needle;
  IF v_kind IS NOT NULL THEN RETURN json_build_object('valid', TRUE, 'kind', v_kind); END IF;

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
-- time an account gets an academy. It can never set 'admin', and (note B
-- above) an academy code can never grant 'coach' either — a coach seat only
-- ever comes from a real coach code, checked in the branch below. It never
-- overwrites a role or academy_id the account already has.
--
-- p_expect_kind (note C above) lets a caller that only makes sense for one
-- kind of code — joinByInviteCode() only ever wants a team_player code —
-- say so, and get an error instead of a silent mutation if the code turns
-- out to be some other kind.
CREATE OR REPLACE FUNCTION redeem_access_code(p_code TEXT, p_role TEXT DEFAULT NULL, p_expect_kind TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_needle    TEXT := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
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
  IF p_role IS NOT NULL AND p_role NOT IN ('coach', 'player', 'parent') THEN
    -- profiles.role's own CHECK constraint would catch most of this
    -- anyway, but as a raw Postgres error rather than this function's
    -- {error} contract — reject here first so every caller gets the same
    -- shape of response regardless of what garbage a client sends.
    RETURN json_build_object('error', 'Not a valid role.');
  END IF;

  SELECT id, role, academy_id INTO v_profile FROM profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN
    RETURN json_build_object('error', 'Profile not found.');
  END IF;

  -- ── Team coach code ──────────────────────────────────────────
  SELECT id INTO v_team FROM teams WHERE upper(coach_code) = v_needle AND active = TRUE;
  IF v_team.id IS NOT NULL THEN
    IF p_expect_kind IS NOT NULL AND p_expect_kind <> 'team_coach' THEN
      RETURN json_build_object('error', 'That code is a coach code for a team, not what was expected here.');
    END IF;
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
    IF p_expect_kind IS NOT NULL AND p_expect_kind <> 'team_player' THEN
      RETURN json_build_object('error', 'That code is not a squad invite code.');
    END IF;
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
    IF p_expect_kind IS NOT NULL AND p_expect_kind <> 'academy' THEN
      RETURN json_build_object('error', 'That is not a squad invite code — check it with your admin.');
    END IF;
    IF p_role = 'coach' THEN
      -- The whole point of a separate teams.coach_code (019) was that the
      -- academy join code — handed to every parent and player — must never
      -- be enough on its own to claim a coach seat.
      RETURN json_build_object('error', 'A club code can''t make you a coach — ask your admin for your team''s coach code instead.');
    END IF;
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

REVOKE EXECUTE ON FUNCTION redeem_access_code(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION redeem_access_code(TEXT, TEXT, TEXT) TO authenticated;

-- SAFEGUARDING: stop `players.share_token` granting access to a child's records.
--
-- `share_token` did double duty: it is the public passport URL segment
-- (/passport/<token>, unauthenticated, also printed on every PDF player card
-- and encoded in its QR) AND the credential `linkChild` accepted to attach an
-- adult to a child. The policy behind it, `parent_link_insert` (001_schema.sql),
-- checked only `parent_id = auth.uid() AND auth_role() = 'parent'` — nothing
-- tied the adult to the child or to the academy.
--
-- So: read a shared passport link, self-register as a parent, link yourself,
-- and reach the child. And `parents_manage_child_medical` (007_records.sql) is
-- FOR ALL with WITH CHECK mirroring USING, so that stranger could READ AND
-- WRITE the child's blood type, allergies, home address and emergency contacts.
--
-- This is enforced by Postgres, not by the app: the public anon key plus a
-- self-registered parent session is enough to POST /rest/v1/parent_player_links
-- directly. Removing the app's call sites does NOT close it. THIS FILE does.
--
-- After this migration a parent-link credential is issued per child by a coach
-- or admin — the people who actually know which adult belongs to which child.
-- The verification is human; the code only carries it. `share_token` is
-- demoted to what it always should have been: a public identifier that grants
-- nothing. It is deliberately NOT rotated — that would invalidate every
-- printed card in parents' hands for no security benefit.
--
-- Idempotent; safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Grandfather existing links — MUST run before the policy change
-- ─────────────────────────────────────────────────────────────
-- Real parents are using this today. Nothing here invalidates a row; the
-- downstream read policies key only on row existence and are untouched.
--
-- Be clear-eyed about the trade-off: if this has already been exploited, this
-- step permanently blesses the exploit. Run the audit query at the bottom of
-- this file BEFORE this migration and delete anything unaccounted for. The
-- admin "Linked adults" screen exists so the set stays reviewable afterwards.

ALTER TABLE parent_player_links
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_method TEXT
    CHECK (verification_method IN ('grandfathered', 'parent_link_code', 'staff_added'));

UPDATE parent_player_links
SET verified_at         = COALESCE(verified_at, linked_at),
    verification_method = COALESCE(verification_method, 'grandfathered')
WHERE verified_at IS NULL OR verification_method IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Close the insert hole
-- ─────────────────────────────────────────────────────────────
-- Self-service insert is gone entirely. Staff may add a link directly; a
-- parent's own path goes through redeem_parent_link_code() below, which is
-- SECURITY DEFINER and so is checked against Postgres privileges rather than
-- this policy. Same shape as team_coaches in 019_team_coach_code.sql.

DROP POLICY IF EXISTS "parent_link_insert" ON parent_player_links;

DROP POLICY IF EXISTS "parent_link_staff_insert" ON parent_player_links;
CREATE POLICY "parent_link_staff_insert" ON parent_player_links FOR INSERT
  WITH CHECK (
    auth_role() IN ('admin', 'coach')
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = parent_player_links.player_id
        AND p.academy_id = auth_academy_id()
    )
  );

-- Unrelated pre-existing bug, fixed while we are in this file: parent_link_admin
-- was FOR ALL USING (auth_role() = 'admin') with NO WITH CHECK and no academy
-- scoping. For FOR ALL, Postgres reuses USING as the insert check — so an admin
-- of ANY academy could link any parent to any player in any other academy. The
-- schema has been multi-tenant since 009_multiclub.sql.
DROP POLICY IF EXISTS "parent_link_admin" ON parent_player_links;
CREATE POLICY "parent_link_admin" ON parent_player_links FOR ALL
  USING (
    auth_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = parent_player_links.player_id
        AND p.academy_id = auth_academy_id()
    )
  )
  WITH CHECK (
    auth_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = parent_player_links.player_id
        AND p.academy_id = auth_academy_id()
    )
  );

-- parent_link_own (SELECT) and parent_link_delete are deliberately kept as-is.
-- A parent removing their own link is correct and POPIA-friendly.

-- ─────────────────────────────────────────────────────────────
-- 3. Parent-link codes
-- ─────────────────────────────────────────────────────────────
-- Per child, single-use, expiring, revocable, hashed at rest. Deliberately NOT
-- modelled on the access codes in 027 — those are shared, permanent and
-- unlimited-use, which is right for "join this squad" and wrong for the only
-- gate on a child's medical record.
--
-- 5 random bytes → 10 hex chars → 16^10 ≈ 1.1e12, against 16^6 ≈ 16.7M for a
-- club code. Hashing forces show-once, which costs one click to reissue.

CREATE TABLE IF NOT EXISTS parent_link_codes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    UUID        NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  code_hash    TEXT        NOT NULL UNIQUE,
  code_last4   TEXT        NOT NULL,
  relationship TEXT,
  issued_by    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  redeemed_at  TIMESTAMPTZ,
  redeemed_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS parent_link_codes_player_idx ON parent_link_codes (player_id);

-- RLS on with NO policies: default-deny for every role. Every read and write
-- goes through the SECURITY DEFINER functions below, so the hash is never
-- reachable over PostgREST even by an authenticated staff session.
ALTER TABLE parent_link_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parent_link_codes FROM authenticated, anon;

-- Throttle redemption attempts. Migration 027 could not do this for access
-- codes because peek_access_code is anonymous; parent-link redemption is
-- authenticated, so the actor is known and the limit can live in the database
-- rather than in proxy.ts's per-process, per-IP map (which a direct PostgREST
-- call bypasses entirely).
CREATE TABLE IF NOT EXISTS parent_link_attempts (
  actor_id     UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  attempts     INT         NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE parent_link_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON parent_link_attempts FROM authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 4. Staff: issue / list / revoke
-- ─────────────────────────────────────────────────────────────

/** True when the caller is an admin of, or a coach of a team containing, this player. */
CREATE OR REPLACE FUNCTION can_manage_player_links(p_player_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    WHERE p.id = p_player_id
      AND p.academy_id = auth_academy_id()
      AND (
        auth_role() = 'admin'
        OR EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.player_id = p.id AND tm.active = TRUE AND is_team_coach(tm.team_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION issue_parent_link_code(
  p_player_id    UUID,
  p_relationship TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code       TEXT;
  v_live_count INT;
  v_expires    TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not signed in.');
  END IF;

  IF NOT can_manage_player_links(p_player_id) THEN
    RETURN json_build_object('error', 'You do not have access to this player.');
  END IF;

  -- Cap live codes so the issue button cannot be used to farm the keyspace.
  -- Several at once is legitimate (mum and dad), unbounded is not.
  SELECT count(*) INTO v_live_count
  FROM parent_link_codes
  WHERE player_id = p_player_id
    AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at > NOW();

  IF v_live_count >= 5 THEN
    RETURN json_build_object(
      'error', 'There are already 5 unused codes for this player. Revoke one before creating another.'
    );
  END IF;

  v_code    := upper(encode(gen_random_bytes(5), 'hex'));
  v_expires := NOW() + INTERVAL '14 days';

  INSERT INTO parent_link_codes (player_id, code_hash, code_last4, relationship, issued_by, expires_at)
  VALUES (
    p_player_id,
    encode(digest(v_code, 'sha256'), 'hex'),
    right(v_code, 4),
    NULLIF(trim(COALESCE(p_relationship, '')), ''),
    auth.uid(),
    v_expires
  );

  -- The only time the plaintext exists outside the issuer's screen.
  RETURN json_build_object('success', TRUE, 'code', v_code, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION list_parent_link_codes(p_player_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_rows JSON;
BEGIN
  IF NOT can_manage_player_links(p_player_id) THEN
    RETURN json_build_object('error', 'You do not have access to this player.');
  END IF;

  -- Metadata only. code_hash is never returned by anything, ever.
  SELECT COALESCE(json_agg(r ORDER BY r.issued_at DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT
      c.id,
      c.code_last4,
      c.relationship,
      ib.full_name AS issued_by_name,
      c.issued_at,
      c.expires_at,
      c.redeemed_at,
      rb.full_name AS redeemed_by_name,
      c.revoked_at,
      CASE
        WHEN c.revoked_at  IS NOT NULL THEN 'revoked'
        WHEN c.redeemed_at IS NOT NULL THEN 'redeemed'
        WHEN c.expires_at  < NOW()     THEN 'expired'
        ELSE 'live'
      END AS status
    FROM parent_link_codes c
    LEFT JOIN profiles ib ON ib.id = c.issued_by
    LEFT JOIN profiles rb ON rb.id = c.redeemed_by
    WHERE c.player_id = p_player_id
  ) r;

  RETURN json_build_object('success', TRUE, 'codes', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION revoke_parent_link_code(p_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_player_id UUID;
BEGIN
  SELECT player_id INTO v_player_id FROM parent_link_codes WHERE id = p_id;

  IF v_player_id IS NULL OR NOT can_manage_player_links(v_player_id) THEN
    RETURN json_build_object('error', 'Code not found.');
  END IF;

  UPDATE parent_link_codes
  SET revoked_at = NOW()
  WHERE id = p_id AND redeemed_at IS NULL AND revoked_at IS NULL;

  RETURN json_build_object('success', TRUE);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Parent: redeem
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_parent_link_failure()
RETURNS VOID LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO parent_link_attempts (actor_id, attempts, window_start)
  VALUES (auth.uid(), 1, NOW())
  ON CONFLICT (actor_id) DO UPDATE SET attempts = parent_link_attempts.attempts + 1;
END;
$$;

CREATE OR REPLACE FUNCTION redeem_parent_link_code(
  p_code         TEXT,
  p_relationship TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_needle     TEXT;
  v_code       parent_link_codes%ROWTYPE;
  v_role       TEXT;
  v_academy    UUID;
  v_p_academy  UUID;
  v_child_name TEXT;
  v_attempts   INT;
  v_window     TIMESTAMPTZ;
  -- ONE message for every failure mode. Distinguishing "expired" from "no such
  -- code" would tell a brute-forcer they had found a real code.
  c_generic CONSTANT TEXT := 'That code is not valid. Ask your child''s coach for a new one.';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not signed in.');
  END IF;

  -- Throttle: 5 failures per 15-minute window, per account.
  SELECT attempts, window_start INTO v_attempts, v_window
  FROM parent_link_attempts WHERE actor_id = auth.uid();

  IF v_window IS NOT NULL AND v_window < NOW() - INTERVAL '15 minutes' THEN
    UPDATE parent_link_attempts SET attempts = 0, window_start = NOW() WHERE actor_id = auth.uid();
    v_attempts := 0;
  END IF;

  IF COALESCE(v_attempts, 0) >= 5 THEN
    RETURN json_build_object('error', 'Too many attempts. Wait 15 minutes and try again.');
  END IF;

  v_needle := regexp_replace(upper(COALESCE(p_code, '')), '[^A-Z0-9]', '', 'g');

  IF length(v_needle) <> 10 THEN
    PERFORM record_parent_link_failure();
    RETURN json_build_object('error', c_generic);
  END IF;

  -- FOR UPDATE: two simultaneous redemptions of one code must not both win.
  SELECT * INTO v_code
  FROM parent_link_codes
  WHERE code_hash = encode(digest(v_needle, 'sha256'), 'hex')
  FOR UPDATE;

  IF v_code.id IS NULL
     OR v_code.redeemed_at IS NOT NULL
     OR v_code.revoked_at  IS NOT NULL
     OR v_code.expires_at  < NOW() THEN
    PERFORM record_parent_link_failure();
    RETURN json_build_object('error', c_generic);
  END IF;

  -- Never auto-promote. A player or coach account redeeming a parent code is
  -- an error, not a role change (same reasoning as 027's note on roles).
  SELECT role, academy_id INTO v_role, v_academy FROM profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'parent' THEN
    RETURN json_build_object(
      'error', 'Only a parent or guardian account can use a child link code.'
    );
  END IF;

  SELECT academy_id, full_name INTO v_p_academy, v_child_name
  FROM players WHERE id = v_code.player_id;

  IF v_academy IS NOT NULL AND v_academy IS DISTINCT FROM v_p_academy THEN
    RETURN json_build_object('error', 'That code belongs to a different academy.');
  END IF;

  -- Attaching the academy here is why a parent no longer needs the club-wide
  -- join code at all — a code handed to everybody and effectively public.
  IF v_academy IS NULL THEN
    UPDATE profiles SET academy_id = v_p_academy WHERE id = auth.uid();
  END IF;

  INSERT INTO parent_player_links (
    parent_id, player_id, relationship, verified_at, verified_by, verification_method
  )
  VALUES (
    auth.uid(),
    v_code.player_id,
    COALESCE(NULLIF(trim(COALESCE(p_relationship, '')), ''), v_code.relationship, 'parent'),
    NOW(),
    v_code.issued_by,
    'parent_link_code'
  )
  ON CONFLICT (parent_id, player_id) DO NOTHING;

  UPDATE parent_link_codes
  SET redeemed_at = NOW(), redeemed_by = auth.uid()
  WHERE id = v_code.id;

  DELETE FROM parent_link_attempts WHERE actor_id = auth.uid();

  RETURN json_build_object('success', TRUE, 'child_name', v_child_name, 'player_id', v_code.player_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Privileges — never anon
-- ─────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION can_manage_player_links(UUID)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION issue_parent_link_code(UUID, TEXT)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION list_parent_link_codes(UUID)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION revoke_parent_link_code(UUID)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION redeem_parent_link_code(TEXT, TEXT)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION record_parent_link_failure()         FROM PUBLIC;

GRANT EXECUTE ON FUNCTION can_manage_player_links(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION issue_parent_link_code(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION list_parent_link_codes(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_parent_link_code(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_parent_link_code(TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 7. Public passport: stop publishing a minor's identity data
-- ─────────────────────────────────────────────────────────────
-- Three changes to what leaves this function, all to an unauthenticated,
-- publicly-cacheable endpoint about a named child:
--
--   date_of_birth → age   DOB is an identity-document field; under POPIA it
--                         sits beside the ID number. An integer age is already
--                         implied by the LTPD badge and the U11/U13/U15 team
--                         name, so nothing on the page is lost.
--   ratings[].note        DROPPED. Up to 200 characters of a coach's free-text
--                         opinion about a named child. A coach writing
--                         "struggling since his dad left" had published it.
--                         029_shared_play_notes_privacy.sql set this precedent.
--   id                    DROPPED. Internal UUID, used as childId in the parent
--                         routes. Nothing public needs it.
--
-- Carries 023's photo-consent CASE and 031's 25-attribute list forward
-- unchanged. Also returns NULL rather than an error object for an unknown
-- token, so no future consumer repeats the truthy-error bug that made an
-- invalid passport link throw a 500.
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

-- ─────────────────────────────────────────────────────────────
-- VERIFY — run these by hand; none of it can be tested in CI
-- ─────────────────────────────────────────────────────────────
-- There is no Postgres server, no Docker and no Supabase CLI in the
-- development environment, so a green CI run says NOTHING about whether any of
-- the above works. These are the real tests.
--
-- BEFORE running this migration — the grandfathering audit. Review with the
-- academy director; DELETE anything that cannot be accounted for, because
-- section 1 blesses whatever is left:
--
--   SELECT pr.full_name AS parent, pr.id AS parent_id, p.full_name AS child,
--          l.linked_at, l.relationship,
--          (m.emergency_1_name ILIKE '%' || split_part(pr.full_name, ' ', 1) || '%'
--           OR m.emergency_2_name ILIKE '%' || split_part(pr.full_name, ' ', 1) || '%')
--            AS named_as_emergency_contact
--   FROM parent_player_links l
--   JOIN profiles pr ON pr.id = l.parent_id
--   JOIN players  p  ON p.id  = l.player_id
--   LEFT JOIN player_medical m ON m.player_id = l.player_id
--   ORDER BY named_as_emergency_contact NULLS FIRST, l.linked_at DESC;
--
-- AFTER running:
--  1. SELECT count(*) FILTER (WHERE verified_at IS NULL) FROM parent_player_links;  -- must be 0
--  2. SELECT polname FROM pg_policy WHERE polrelid = 'parent_player_links'::regclass;
--     -- parent_link_insert GONE, parent_link_staff_insert PRESENT
--  3. THE ACTUAL REGRESSION TEST — as a real parent's session token, against
--     PostgREST directly, NOT through the UI (the UI is not the boundary):
--       curl -X POST "$SUPABASE_URL/rest/v1/parent_player_links" \
--         -H "apikey: $ANON_KEY" -H "Authorization: Bearer $PARENT_JWT" \
--         -H "Content-Type: application/json" \
--         -d '{"parent_id":"<that parent>","player_id":"<an unrelated child>"}'
--     -- must return 42501 (RLS violation). Before this migration it succeeds.
--  4. Same session: GET /rest/v1/player_medical?player_id=eq.<unrelated>  -- must be []
--  5. An existing (grandfathered) parent opens their child's page -- full page,
--     medical form intact. The "don't break real parents" check.
--  6. Issue a code, redeem once -> success; redeem the same code again ->
--     generic failure; redeemed_at / redeemed_by set.
--  7. Six wrong codes from one account -> throttled on the sixth, same message.
--  8. /passport/<real token> -> age badge renders; NO date_of_birth and NO
--     coach notes anywhere in view-source. /passport/deadbeef00 -> clean 404.
--  9. A player whose photo_consent is FALSE still shows NO photo. Re-check this
--     explicitly — section 7 rewrites the function that enforces it, so it is
--     the regression this migration is most likely to cause.

-- 019_team_coach_code.sql
--
-- Two changes that go together:
--
-- 1. An admin can set up the academy's teams up front and hand each one to a
--    coach with a code, instead of every coach creating their own team.
-- 2. A team can have more than one coach — a technical director working across
--    every age group alongside the age-group coach, or an assistant.
--
-- teams.coach_id is kept as the head coach (for display and existing writes);
-- team_coaches is the source of truth for who may coach a team.

-- ── Coach code ────────────────────────────────────────────────
-- Deliberately separate from teams.invite_code: that code goes to players, so
-- reusing it would let anyone with the player link claim a coaching seat.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS coach_code TEXT UNIQUE
    DEFAULT upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

UPDATE teams
SET    coach_code = upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
WHERE  coach_code IS NULL;

-- ── Coaching roster ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_coaches (
  team_id   UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  coach_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_head   BOOLEAN     NOT NULL DEFAULT FALSE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, coach_id)
);

CREATE INDEX IF NOT EXISTS team_coaches_coach_idx ON team_coaches (coach_id);

-- Existing single coaches become the head coach on their team.
INSERT INTO team_coaches (team_id, coach_id, is_head)
SELECT id, coach_id, TRUE FROM teams WHERE coach_id IS NOT NULL
ON CONFLICT (team_id, coach_id) DO NOTHING;

ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_coach_read_academy" ON team_coaches;
DROP POLICY IF EXISTS "team_coach_admin_write"  ON team_coaches;

CREATE POLICY "team_coach_read_academy" ON team_coaches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM teams t WHERE t.id = team_coaches.team_id AND t.academy_id = auth_academy_id())
  );

-- Coaches join through the RPC below, which is SECURITY DEFINER; direct writes
-- are an admin action.
CREATE POLICY "team_coach_admin_write" ON team_coaches
  FOR ALL USING (
    auth_role() = 'admin'
    AND EXISTS (SELECT 1 FROM teams t WHERE t.id = team_coaches.team_id AND t.academy_id = auth_academy_id())
  );

/** True when the caller coaches this team. */
CREATE OR REPLACE FUNCTION is_team_coach(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_coaches tc
    WHERE tc.team_id = p_team_id AND tc.coach_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Claim a team with its coach code
-- ─────────────────────────────────────────────────────────────
-- Joins the coaching roster. The first coach on a team becomes the head coach;
-- anyone joining afterwards is an additional coach.

CREATE OR REPLACE FUNCTION claim_team_by_coach_code(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_team       RECORD;
  v_role       TEXT;
  v_academy_id UUID;
  v_is_first   BOOLEAN;
  v_needle     TEXT := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
BEGIN
  IF v_needle = '' THEN
    RETURN json_build_object('error', 'Enter the coach code for your team.');
  END IF;

  SELECT role, academy_id INTO v_role, v_academy_id
  FROM   profiles WHERE id = auth.uid();

  IF v_role NOT IN ('coach', 'admin') THEN
    RETURN json_build_object('error', 'Only a coach can claim a team.');
  END IF;

  SELECT id, name, academy_id, coach_id
  INTO   v_team
  FROM   teams
  WHERE  upper(coach_code) = v_needle AND active = TRUE;

  IF v_team.id IS NULL THEN
    RETURN json_build_object('error', 'No team found with that code. Check it with your admin.');
  END IF;

  IF v_academy_id IS NOT NULL AND v_academy_id <> v_team.academy_id THEN
    RETURN json_build_object('error', 'That team belongs to a different academy.');
  END IF;

  IF EXISTS (SELECT 1 FROM team_coaches WHERE team_id = v_team.id AND coach_id = auth.uid()) THEN
    RETURN json_build_object('success', TRUE, 'team_name', v_team.name, 'already', TRUE);
  END IF;

  v_is_first := NOT EXISTS (SELECT 1 FROM team_coaches WHERE team_id = v_team.id);

  INSERT INTO team_coaches (team_id, coach_id, is_head)
  VALUES (v_team.id, auth.uid(), v_is_first)
  ON CONFLICT (team_id, coach_id) DO NOTHING;

  -- Keep teams.coach_id pointing at the head coach.
  IF v_is_first THEN
    UPDATE teams SET coach_id = auth.uid() WHERE id = v_team.id AND coach_id IS NULL;
  END IF;

  UPDATE profiles
  SET    academy_id = COALESCE(academy_id, v_team.academy_id)
  WHERE  id = auth.uid();

  RETURN json_build_object('success', TRUE, 'team_name', v_team.name, 'is_head', v_is_first);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Admin: rotate a coach code, remove a coach
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reset_team_coach_code(p_team_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code TEXT := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) <> 'admin' THEN
    RETURN json_build_object('error', 'Only an admin can reset a coach code.');
  END IF;

  UPDATE teams SET coach_code = v_code
  WHERE  id = p_team_id AND academy_id = auth_academy_id();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Team not found in your academy.');
  END IF;

  RETURN json_build_object('success', TRUE, 'coach_code', v_code);
END;
$$;

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

  -- If the head coach left, promote whoever has been there longest.
  SELECT coach_id INTO v_next
  FROM   team_coaches WHERE team_id = p_team_id
  ORDER  BY added_at ASC LIMIT 1;

  UPDATE team_coaches SET is_head = TRUE
  WHERE  team_id = p_team_id AND coach_id = v_next;

  UPDATE teams SET coach_id = v_next WHERE id = p_team_id;

  RETURN json_build_object('success', TRUE);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Keep the roster in step when a team is created
-- ─────────────────────────────────────────────────────────────
-- Every "my teams" query now reads team_coaches, so the creator must be on the
-- roster or they would not see the team they just made. A trigger handles it
-- rather than an app-side insert, which RLS (admin-only writes) would reject.

CREATE OR REPLACE FUNCTION add_creator_to_team_coaches()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.coach_id IS NOT NULL THEN
    INSERT INTO team_coaches (team_id, coach_id, is_head)
    VALUES (NEW.id, NEW.coach_id, TRUE)
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_add_creator_coach ON teams;
CREATE TRIGGER teams_add_creator_coach
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION add_creator_to_team_coaches();

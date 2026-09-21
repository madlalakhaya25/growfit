-- Subscribable calendar feeds.
--
-- A calendar client (Apple Calendar, Google Calendar, Outlook) sends no
-- cookies and cannot sign in, so the feed URL itself has to carry the
-- credential. Two rules follow from that, and both are deliberate:
--
-- 1. **A dedicated token, not `players.share_token`.** That token is the
--    public passport URL and is printed on every PDF player card. Migration
--    032 exists precisely because it had been overloaded as a second
--    credential (it was what `linkChild` accepted to attach an adult to a
--    child). Reusing it here would repeat the mistake the academy has
--    already paid to fix: anyone who saw a printed card would get a feed of
--    that child's whereabouts every week.
--
-- 2. **Per-person, not per-team.** A shared team URL cannot be revoked for
--    one parent without breaking it for everyone. This hangs off `profiles`,
--    so regenerating one person's token affects only them.
--
-- The token is a random UUID, null until someone asks for a feed — nobody
-- gets a live credential they never requested.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS calendar_token UUID;

-- Unique so a token resolves to exactly one profile; partial so the many
-- NULLs (everyone who has never opened the calendar page) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_calendar_token_key
  ON profiles (calendar_token)
  WHERE calendar_token IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- Issue / rotate a caller's own token
-- ─────────────────────────────────────────────────────────────────
-- SECURITY DEFINER because `profiles` UPDATE policies do not (and should
-- not) grant a user write access to arbitrary columns; this grants exactly
-- one column, on exactly their own row.
CREATE OR REPLACE FUNCTION issue_calendar_token(p_rotate BOOLEAN DEFAULT FALSE)
RETURNS UUID LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_token UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT calendar_token INTO v_token FROM profiles WHERE id = auth.uid();

  IF v_token IS NULL OR p_rotate THEN
    v_token := gen_random_uuid();
    UPDATE profiles SET calendar_token = v_token WHERE id = auth.uid();
  END IF;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION issue_calendar_token(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_calendar_token(BOOLEAN) TO authenticated;

-- ─────────────────────────────────────────────────────────────────
-- Resolve a token to that person's events
-- ─────────────────────────────────────────────────────────────────
-- Returns only what belongs in a calendar entry: what, when, where. No
-- player names, no medical information, no ID or SAFA numbers — the feed URL
-- is a bearer credential that will end up synced to phones and laptops, and
-- POPIA governs everything this academy holds about a child.
--
-- Cancelled fixtures are returned rather than filtered out: a subscriber
-- whose calendar already holds the event needs to be told it is off, which
-- an .ics STATUS:CANCELLED does and a missing event does not.
CREATE OR REPLACE FUNCTION get_calendar_events(p_token UUID)
RETURNS TABLE (
  uid          TEXT,
  kind         TEXT,
  title        TEXT,
  starts_at    TIMESTAMPTZ,
  location     TEXT,
  description  TEXT,
  status       TEXT,
  team_name    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_team_ids  UUID[];
BEGIN
  IF p_token IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE calendar_token = p_token;
  IF v_profile.id IS NULL THEN
    RETURN;  -- unknown or revoked token: an empty calendar, not an error
  END IF;

  -- Which teams this person is entitled to see, by role.
  IF v_profile.role = 'coach' OR v_profile.role = 'admin' THEN
    SELECT COALESCE(array_agg(DISTINCT t.id), '{}')
      INTO v_team_ids
      FROM teams t
     WHERE t.active
       AND t.academy_id = v_profile.academy_id
       AND (
         v_profile.role = 'admin'
         OR t.coach_id = v_profile.id
         OR EXISTS (SELECT 1 FROM team_coaches tc
                     WHERE tc.team_id = t.id AND tc.coach_id = v_profile.id)
       );

  ELSIF v_profile.role = 'parent' THEN
    -- Every team any linked child plays for.
    SELECT COALESCE(array_agg(DISTINCT tm.team_id), '{}')
      INTO v_team_ids
      FROM parent_player_links ppl
      JOIN team_members tm ON tm.player_id = ppl.player_id AND tm.active
     WHERE ppl.parent_id = v_profile.id;

  ELSE  -- player
    SELECT COALESCE(array_agg(DISTINCT tm.team_id), '{}')
      INTO v_team_ids
      FROM players p
      JOIN team_members tm ON tm.player_id = p.id AND tm.active
     WHERE p.profile_id = v_profile.id;
  END IF;

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT
      'fixture-' || f.id::TEXT,
      'fixture',
      CASE WHEN f.is_home THEN t.name || ' vs ' || f.opponent
           ELSE t.name || ' away to ' || f.opponent END,
      f.fixture_date,
      f.venue,
      COALESCE(
        CASE WHEN f.status = 'cancelled'
             THEN 'Cancelled: ' || COALESCE(f.cancellation_reason, 'no reason given')
             ELSE f.notes END,
        ''
      ),
      f.status,
      t.name
    FROM fixtures f
    JOIN teams t ON t.id = f.team_id
    WHERE f.team_id = ANY(v_team_ids)

    UNION ALL

    SELECT
      'session-' || s.id::TEXT,
      'training',
      t.name || ' — ' || s.title,
      s.session_date,
      s.location,
      COALESCE(s.notes, ''),
      'confirmed',
      t.name
    FROM training_sessions s
    JOIN teams t ON t.id = s.team_id
    WHERE s.team_id = ANY(v_team_ids);
END;
$$;

REVOKE ALL ON FUNCTION get_calendar_events(UUID) FROM PUBLIC;
-- `anon` deliberately: the feed is fetched by a calendar client with no
-- session at all. The token in the argument is the entire authorisation,
-- which is why the function returns no personal data beyond what/when/where.
GRANT EXECUTE ON FUNCTION get_calendar_events(UUID) TO anon, authenticated;

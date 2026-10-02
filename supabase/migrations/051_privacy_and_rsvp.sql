-- 051_privacy_and_rsvp.sql
--
-- Stage 1 of docs "Growfit: the road to world class" -- three database holes
-- found in the 2026-10-02 audit. All three narrow who can read or write a row;
-- none adds a column to an existing table or changes a row that exists.
--
-- 1. tactic_plays was readable by EVERY member of the academy (015), so any
--    signed-in player or parent could read any play's raw data -- drafts,
--    other teams' plays, and the per-child coach notes migration 029 hides in
--    get_shared_play(). Now: staff read academy-wide as before; a player reads
--    only plays that are SHARED with a team they are an active member of.
--    (A teammate can still read a shared play's data, notes included, straight
--    from the table. Closing that needs the notes split out of the play row --
--    a separate step; this one stops reading unshared and other teams' plays.)
--
-- 2. player_milestone_completions' read policy was academy-wide (012), so any
--    signed-in member -- including other parents -- could read every child's
--    milestone notes. Now: staff in the academy, the player, and the player's
--    linked parents.
--
-- 3. Player RSVPs and the coach's register shared one row. The player's
--    "Going" tap wrote 'present' into training_attendance (policy
--    players_manage_own_attendance is FOR ALL, with no time limit), so a no-show
--    who tapped Going stayed present, a player could excuse themselves out of
--    the 75% welfare count, and could overwrite a coach's mark after the
--    session. Now RSVPs live in their own table, writable by the player only
--    until the session starts, and training_attendance is the coach's alone
--    (a player keeps read access to their own rows).
--
-- Existing RSVP-origin attendance rows (marked_by IS NULL: every coach mark sets
-- marked_by) are COPIED into training_rsvps and left in place. Deleting them is
-- a production data change and is done separately, after looking at the count.
--
-- Safe to re-run: IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT DO NOTHING.

BEGIN;

-- 1. tactic_plays ----------------------------------------------------------

DROP POLICY IF EXISTS "tactic_play_read_academy"        ON tactic_plays;
DROP POLICY IF EXISTS "tactic_play_staff_read"          ON tactic_plays;
DROP POLICY IF EXISTS "tactic_play_player_read_shared"  ON tactic_plays;

CREATE POLICY "tactic_play_staff_read" ON tactic_plays
  FOR SELECT TO authenticated
  USING (academy_id = auth_academy_id() AND is_admin_or_coach());

CREATE POLICY "tactic_play_player_read_shared" ON tactic_plays
  FOR SELECT TO authenticated
  USING (
    shared
    AND team_id IN (
      SELECT tm.team_id
        FROM team_members tm
        JOIN players pl ON pl.id = tm.player_id
       WHERE tm.active AND pl.profile_id = auth.uid()
    )
  );

-- 2. player_milestone_completions -----------------------------------------

DROP POLICY IF EXISTS "academy_members_read_completions" ON player_milestone_completions;
DROP POLICY IF EXISTS "completions_staff_read"           ON player_milestone_completions;
DROP POLICY IF EXISTS "completions_player_read"          ON player_milestone_completions;
DROP POLICY IF EXISTS "completions_parent_read"          ON player_milestone_completions;

CREATE POLICY "completions_staff_read" ON player_milestone_completions
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coach()
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
  );

CREATE POLICY "completions_player_read" ON player_milestone_completions
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

CREATE POLICY "completions_parent_read" ON player_milestone_completions
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT player_id FROM parent_player_links WHERE parent_id = auth.uid()));

-- 3. RSVPs apart from the register ----------------------------------------

CREATE TABLE IF NOT EXISTS training_rsvps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  response     TEXT NOT NULL CHECK (response IN ('going', 'cant')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS training_rsvps_session_idx ON training_rsvps (session_id);

ALTER TABLE training_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvps_player_manage_before_start" ON training_rsvps;
CREATE POLICY "rsvps_player_manage_before_start" ON training_rsvps
  FOR ALL TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()))
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND session_id IN (SELECT id FROM training_sessions WHERE session_date > now())
  );

DROP POLICY IF EXISTS "rsvps_staff_read" ON training_rsvps;
CREATE POLICY "rsvps_staff_read" ON training_rsvps
  FOR SELECT TO authenticated
  USING (
    is_admin_or_coach()
    AND session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    )
  );

-- Copy, never move: see the header.
INSERT INTO training_rsvps (session_id, player_id, response, responded_at)
SELECT session_id, player_id,
       CASE status WHEN 'present' THEN 'going' ELSE 'cant' END,
       COALESCE(created_at, now())
  FROM training_attendance
 WHERE marked_by IS NULL
   AND status IN ('present', 'excused')
ON CONFLICT (session_id, player_id) DO NOTHING;

-- The register is the coach's: players lose write access, keep read of their own.
DROP POLICY IF EXISTS "players_manage_own_attendance" ON training_attendance;
DROP POLICY IF EXISTS "players_read_own_attendance"   ON training_attendance;
CREATE POLICY "players_read_own_attendance" ON training_attendance
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

COMMIT;

-- To verify after running:
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('tactic_plays','player_milestone_completions','training_rsvps','training_attendance')
--    ORDER BY 1, 2;
--   -- tactic_plays: staff_read, player_read_shared, staff_write, staff_update, staff_delete (no read_academy)
--   -- player_milestone_completions: completions_staff_read / _player_read / _parent_read (+ any write policies)
--   -- training_attendance: coaches_*, players_read_own_attendance (no players_manage_own_attendance)
--   SELECT count(*) FROM training_attendance WHERE marked_by IS NULL;   -- rows left to clean up
--   SELECT count(*) FROM training_rsvps;                                 -- copied RSVPs

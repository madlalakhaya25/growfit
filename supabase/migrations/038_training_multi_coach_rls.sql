-- BUG: a second coach on a team cannot see, mark attendance for, or manage
-- drills on a training session a colleague created — even though migration
-- 019 added `team_coaches` specifically so a team can have more than one
-- coach (a technical director working across every age group alongside the
-- age-group coach, exactly this academy's real structure).
--
-- `training_sessions_coach_all` (migration 003), `training_drills_coach_all`
-- (migration 003) and `coaches_read_session_attendance` /
-- `coaches_manage_session_attendance` (migrations 005 / 012) all predate
-- `team_coaches` and still gate every command on
--
--     coach_id = auth.uid()   -- the ONE profile that created the row
--
-- rather than on team membership. Every other coach-writable table that
-- existed before migration 019 (`teams`, `fixtures`, `players`,
-- `team_members`) was already brought onto the academy-wide
-- `is_admin_or_coach()` pattern (see `fixture_staff_write` /
-- `fixture_staff_update` in migration 001) -- these four training tables
-- were simply missed.
--
-- Concretely, before this migration: the coach training list
-- (`coach/training/page.tsx`) filters `team_id` AND `coach_id = auth.uid()`,
-- so a co-coach's sessions for a shared team don't even show up in the
-- list; the session detail page (`coach/training/[id]/page.tsx`) filters
-- `coach_id = auth.uid()` outright, so opening a colleague's session
-- 404s; and `markTrainingAttendance` / `markAllPresent`
-- (`app/actions/attendance.ts`) check `coach_id = auth.uid()` before
-- writing, so a co-coach cannot mark attendance for a session they did not
-- personally create even if the app-level check were relaxed, because RLS
-- would silently reject the write underneath it regardless.
--
-- Fix: match the academy-wide pattern already used for fixtures/players/
-- team_members -- any admin or coach in the same academy as the session's
-- team may act on it. The app layer's own `getCoachedTeamIds()` filters
-- (already correct, see docs/BACKLOG.md 1.5) remain the finer-grained "my
-- own team" boundary on top of this, exactly as they already are for
-- fixtures and tactic_plays.

BEGIN;

DROP POLICY IF EXISTS "training_sessions_coach_all" ON training_sessions;
CREATE POLICY "training_sessions_coach_all" ON training_sessions
  FOR ALL TO authenticated
  USING (
    is_admin_or_coach() AND
    EXISTS (SELECT 1 FROM teams t WHERE t.id = training_sessions.team_id AND t.academy_id = auth_academy_id())
  )
  WITH CHECK (
    is_admin_or_coach() AND
    EXISTS (SELECT 1 FROM teams t WHERE t.id = training_sessions.team_id AND t.academy_id = auth_academy_id())
  );

DROP POLICY IF EXISTS "training_drills_coach_all" ON training_drills;
CREATE POLICY "training_drills_coach_all" ON training_drills
  FOR ALL TO authenticated
  USING (
    is_admin_or_coach() AND
    session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    )
  )
  WITH CHECK (
    is_admin_or_coach() AND
    session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    )
  );

-- `coaches_manage_session_attendance` (FOR ALL) already covers every command
-- `coaches_read_session_attendance` (FOR SELECT) does, making the read-only
-- policy redundant -- but it is updated too rather than left as a second,
-- stale definition of "which coach" sitting beside the correct one.
DROP POLICY IF EXISTS "coaches_read_session_attendance" ON training_attendance;
CREATE POLICY "coaches_read_session_attendance" ON training_attendance
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    ) AND is_admin_or_coach()
  );

DROP POLICY IF EXISTS "coaches_manage_session_attendance" ON training_attendance;
CREATE POLICY "coaches_manage_session_attendance" ON training_attendance
  FOR ALL TO authenticated
  USING (
    is_admin_or_coach() AND
    session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    )
  )
  WITH CHECK (
    is_admin_or_coach() AND
    session_id IN (
      SELECT ts.id FROM training_sessions ts
      JOIN teams t ON t.id = ts.team_id
      WHERE t.academy_id = auth_academy_id()
    )
  );

COMMIT;

-- Safe to re-run: every policy is dropped by name before being re-created.
--
-- Verify with two coach profiles in the same academy, both in team_coaches
-- for the same team, one of whom did not create the session:
--   SELECT * FROM training_sessions WHERE team_id = '<shared team>';   -- as the non-creating coach, should now return the row
--   UPDATE training_attendance SET status = 'present' WHERE session_id = '<id>' AND player_id = '<id>';  -- should now succeed for the non-creating coach

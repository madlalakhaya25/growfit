-- 056_coach_notes.sql
--
-- Coach notes: a short typed or dictated note about one player, or about one
-- training session (the voice debrief after training). Text only. Audio is
-- never stored: a dictated note is transcribed, the coach reads and edits the
-- words, and only then are they saved.
--
-- Additive only: a new table.
--
-- Who can read: the coach who wrote it, and admins of the same academy. Other
-- coaches cannot read it, and neither can players or parents (there is no
-- policy for them, so row-level security denies by default).
-- Who can write: staff, for their own notes in their own academy.
--
-- subject_id is a player id or a training session id depending on subject_type,
-- so it carries no foreign key; the app checks the coach may act on it, and a
-- note is removed with the player (see lib/player-erasure) rather than by cascade.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS coach_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id   UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('player','session')),
  subject_id   UUID NOT NULL,
  author_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  source       TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','voice')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_notes_subject_idx ON coach_notes (subject_type, subject_id, created_at DESC);

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_notes_author_read"  ON coach_notes;
DROP POLICY IF EXISTS "coach_notes_admin_read"   ON coach_notes;
DROP POLICY IF EXISTS "coach_notes_author_write" ON coach_notes;
DROP POLICY IF EXISTS "coach_notes_author_delete" ON coach_notes;
DROP POLICY IF EXISTS "coach_notes_admin_delete" ON coach_notes;

CREATE POLICY "coach_notes_author_read" ON coach_notes
  FOR SELECT TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "coach_notes_admin_read" ON coach_notes
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' AND academy_id = auth_academy_id());

CREATE POLICY "coach_notes_author_write" ON coach_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_coach()
    AND author_id = auth.uid()
    AND academy_id = auth_academy_id()
  );

CREATE POLICY "coach_notes_author_delete" ON coach_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- An admin can delete any note in the academy: erasing a player (POPIA) has to
-- remove the notes about them whoever wrote them.
CREATE POLICY "coach_notes_admin_delete" ON coach_notes
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin' AND academy_id = auth_academy_id());

COMMIT;

-- To verify after running: the table exists, RLS is on, five policies.
--   select policyname from pg_policies where tablename = 'coach_notes';

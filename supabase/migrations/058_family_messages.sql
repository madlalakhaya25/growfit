-- 058_family_messages.sql
--
-- Coach-approved messages for a child and their family: a short match story
-- after a game, and (next) a weekly digest. One table for both.
--
-- Additive only: a new table.
--
-- The rule is the development plan's (045): nothing reaches a child or parent
-- until a coach approves it. Staff of the academy write; a player reads only
-- their own, and a parent only their linked child's, and only once approved.
-- Drafts are invisible to families because the read policies require
-- status = 'approved'.
--
-- player_id has a real foreign key with ON DELETE CASCADE, so erasing a player
-- erases their messages with no extra code.
--
-- ref_key says which game or week the message is about: a fixture id for a
-- match story, the Monday's date (YYYY-MM-DD) for a weekly digest. One message
-- per child per kind per ref_key, so regenerating replaces the draft.

BEGIN;

CREATE TABLE IF NOT EXISTS family_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id       UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  player_id        UUID        NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  kind             TEXT        NOT NULL CHECK (kind IN ('match_story', 'weekly_digest')),
  ref_key          TEXT        NOT NULL CHECK (char_length(ref_key) BETWEEN 1 AND 64),
  body             TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1500),
  status           TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  approved_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- Denormalised: a player or parent cannot read the approver's profile row.
  approved_by_name TEXT,
  approved_at      TIMESTAMPTZ,
  created_by       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, kind, ref_key)
);

CREATE INDEX IF NOT EXISTS family_messages_player_idx
  ON family_messages (player_id, kind, created_at DESC);

ALTER TABLE family_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_messages_staff_all" ON family_messages;
CREATE POLICY "family_messages_staff_all" ON family_messages
  FOR ALL TO authenticated
  USING      (is_admin_or_coach() AND academy_id = auth_academy_id())
  WITH CHECK (is_admin_or_coach() AND academy_id = auth_academy_id());

DROP POLICY IF EXISTS "family_messages_player_read" ON family_messages;
CREATE POLICY "family_messages_player_read" ON family_messages
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (SELECT 1 FROM players p WHERE p.id = family_messages.player_id AND p.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "family_messages_parent_read" ON family_messages;
CREATE POLICY "family_messages_parent_read" ON family_messages
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = family_messages.player_id AND ppl.parent_id = auth.uid())
  );

COMMIT;

-- Safe to re-run. Verify with:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'family_messages';
--   -- expect 3: staff_all (ALL), player_read (SELECT), parent_read (SELECT)
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'family_messages';  -- true

-- 015_tactic_plays.sql
--
-- Saved tactical board plays. The board state (tokens, drawn shapes and the
-- animation frames) is stored as JSONB so the board can evolve its shape
-- without another migration. Plays belong to a team and are authored by a
-- coach; anyone in the academy can read them (so a play shared to the squad
-- resolves for players and parents too), but only staff can write.

CREATE TABLE IF NOT EXISTS tactic_plays (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  team_id     UUID        NOT NULL REFERENCES teams(id)     ON DELETE CASCADE,
  coach_id    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  notes       TEXT        CHECK (notes IS NULL OR char_length(notes) <= 500),
  -- { tokens: [...], shapes: [...], frames: [...], formationId, opponentFormationId }
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tactic_plays_team_idx
  ON tactic_plays (team_id, updated_at DESC);

ALTER TABLE tactic_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tactic_play_read_academy"  ON tactic_plays;
DROP POLICY IF EXISTS "tactic_play_staff_write"   ON tactic_plays;
DROP POLICY IF EXISTS "tactic_play_staff_update"  ON tactic_plays;
DROP POLICY IF EXISTS "tactic_play_staff_delete"  ON tactic_plays;

CREATE POLICY "tactic_play_read_academy" ON tactic_plays
  FOR SELECT USING (academy_id = auth_academy_id());

CREATE POLICY "tactic_play_staff_write" ON tactic_plays
  FOR INSERT WITH CHECK (academy_id = auth_academy_id() AND is_admin_or_coach());

CREATE POLICY "tactic_play_staff_update" ON tactic_plays
  FOR UPDATE USING (academy_id = auth_academy_id() AND is_admin_or_coach());

CREATE POLICY "tactic_play_staff_delete" ON tactic_plays
  FOR DELETE USING (academy_id = auth_academy_id() AND is_admin_or_coach());

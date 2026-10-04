-- 066_player_positions.sql
--
-- Up to three positions per player, each with a role ("Centre back, Ball-
-- playing"). Two lists per player:
--   kind 'official'  - what the coach sets; used for team sheets and the board.
--   kind 'preferred' - where the player (or their parent, for U11) likes to play.
-- The player profile shows both side by side.
--
-- players.position and players.secondary_pos stay as the fallback every screen
-- already reads; the app keeps them equal to the official ranks 1 and 2.
--
-- Additive only: one new table. The position and role lists live in the app
-- (web/src/lib/player-roles.ts); the checks here only keep the shape sane.
--
-- Who may do what:
--   official  - admins of the academy, and coaches of a team the player is in,
--               read and write. Players and linked parents read it.
--   preferred - the player and linked parents read and write their own;
--               coaches of the player's team and admins read.
--
-- ON DELETE CASCADE on the player, so erasing a player erases their positions.
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS player_positions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL CHECK (kind IN ('official', 'preferred')),
  rank        SMALLINT    NOT NULL CHECK (rank BETWEEN 1 AND 3),
  position    TEXT        NOT NULL CHECK (position ~ '^[a-z]{2,3}$'),
  role        TEXT        CHECK (role IS NULL OR role ~ '^[a-z0-9_]{1,30}$'),
  set_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, kind, rank),
  UNIQUE (player_id, kind, position)
);

CREATE INDEX IF NOT EXISTS player_positions_player_idx ON player_positions (player_id);

ALTER TABLE player_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_positions_staff_read"    ON player_positions;
DROP POLICY IF EXISTS "player_positions_staff_official" ON player_positions;
DROP POLICY IF EXISTS "player_positions_player_read"   ON player_positions;
DROP POLICY IF EXISTS "player_positions_player_write"  ON player_positions;
DROP POLICY IF EXISTS "player_positions_parent_read"   ON player_positions;
DROP POLICY IF EXISTS "player_positions_parent_write"  ON player_positions;

-- Staff: admins see their whole academy; coaches see players in their teams.
CREATE POLICY "player_positions_staff_read" ON player_positions
  FOR SELECT TO authenticated
  USING (
    (auth_role() = 'admin' AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id()))
    OR EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.player_id = player_positions.player_id
        AND tm.active
        AND (t.coach_id = auth.uid() OR is_team_coach(tm.team_id))
    )
  );

-- Staff write the official list only.
CREATE POLICY "player_positions_staff_official" ON player_positions
  FOR ALL TO authenticated
  USING (
    kind = 'official'
    AND (
      (auth_role() = 'admin' AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id()))
      OR EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.player_id = player_positions.player_id
          AND tm.active
          AND (t.coach_id = auth.uid() OR is_team_coach(tm.team_id))
      )
    )
  )
  WITH CHECK (
    kind = 'official'
    AND (
      (auth_role() = 'admin' AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id()))
      OR EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.player_id = player_positions.player_id
          AND tm.active
          AND (t.coach_id = auth.uid() OR is_team_coach(tm.team_id))
      )
    )
  );

-- A player reads both lists and writes their own preferred list.
CREATE POLICY "player_positions_player_read" ON player_positions
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

CREATE POLICY "player_positions_player_write" ON player_positions
  FOR ALL TO authenticated
  USING (kind = 'preferred' AND player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()))
  WITH CHECK (kind = 'preferred' AND player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

-- A linked parent reads both lists and writes the preferred list for their child.
CREATE POLICY "player_positions_parent_read" ON player_positions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = player_positions.player_id AND ppl.parent_id = auth.uid()));

CREATE POLICY "player_positions_parent_write" ON player_positions
  FOR ALL TO authenticated
  USING (kind = 'preferred' AND EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = player_positions.player_id AND ppl.parent_id = auth.uid()))
  WITH CHECK (kind = 'preferred' AND EXISTS (SELECT 1 FROM parent_player_links ppl WHERE ppl.player_id = player_positions.player_id AND ppl.parent_id = auth.uid()));

COMMIT;

NOTIFY pgrst, 'reload schema';

-- To verify: pg_policies lists six policies on player_positions and
-- pg_class.relrowsecurity is true for it.

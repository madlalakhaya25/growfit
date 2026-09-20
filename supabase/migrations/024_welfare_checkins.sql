-- The 75% attendance threshold is described as triggering a welfare
-- check-in in both the academy's own policy documents and the AI coach
-- assistant's system prompt, but nothing ever surfaced it anywhere a human
-- would see it unprompted — it only ever came up if a coach happened to ask
-- the AI assistant. This table gives a coach or admin a persisted record
-- that a check-in actually happened, for a real child-protection concern.
--
-- Deliberately a log, not a "dismiss" flag: the underlying concern (a player
-- below 75%) is recomputed live from training_attendance every time the
-- surface renders, so it naturally clears once attendance recovers. This
-- table only records that a human looked at it and did something, which is
-- what the safeguarding paper trail actually needs.
CREATE TABLE IF NOT EXISTS welfare_checkins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  noted_by        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_pct  INT,
  note            TEXT CHECK (char_length(note) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welfare_checkins_player ON welfare_checkins(player_id);

ALTER TABLE welfare_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_manage_welfare_checkins" ON welfare_checkins;
CREATE POLICY "coach_manage_welfare_checkins" ON welfare_checkins FOR ALL TO authenticated
  USING (player_id IN (
    SELECT tm.player_id FROM team_members tm
    JOIN team_coaches tc ON tc.team_id = tm.team_id
    WHERE tc.coach_id = auth.uid() AND tm.active = true
  ))
  WITH CHECK (
    noted_by = auth.uid()
    AND player_id IN (
      SELECT tm.player_id FROM team_members tm
      JOIN team_coaches tc ON tc.team_id = tm.team_id
      WHERE tc.coach_id = auth.uid() AND tm.active = true
    )
  );

DROP POLICY IF EXISTS "admin_manage_welfare_checkins" ON welfare_checkins;
CREATE POLICY "admin_manage_welfare_checkins" ON welfare_checkins FOR ALL TO authenticated
  USING (
    auth_role() = 'admin'
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
  )
  WITH CHECK (
    auth_role() = 'admin'
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
  );

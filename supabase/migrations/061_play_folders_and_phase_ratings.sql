-- 061_play_folders_and_phase_ratings.sql
--
-- Two small additive columns, both optional, for features borrowed from the
-- Finalthird coaching app:
--
--   * tactic_plays.folder        — a coach's own folder name for a saved play
--                                  ("Build-up", "Set pieces", "vs Durban City"),
--                                  so the play list works as a library. Free
--                                  text, not a separate table: a folder is
--                                  just the set of plays that share a name.
--   * match_results.phase_ratings — the coach's 1–5 rating of the team in each
--                                  phase of play (in possession, out of
--                                  possession, both transitions, set pieces).
--                                  A team-level judgement, never a child's.
--
-- The app tolerates both columns being absent (42703 / PGRST204), so the code
-- can deploy before this runs.

BEGIN;

ALTER TABLE tactic_plays
  ADD COLUMN IF NOT EXISTS folder TEXT
    CHECK (folder IS NULL OR char_length(folder) BETWEEN 1 AND 40);

CREATE INDEX IF NOT EXISTS tactic_plays_folder_idx
  ON tactic_plays (team_id, folder);

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS phase_ratings JSONB
    CHECK (phase_ratings IS NULL OR jsonb_typeof(phase_ratings) = 'object');

COMMIT;

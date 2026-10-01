-- 049_ai_artefacts_play_roles.sql
--
-- Phase 3 step 3.3, "My job in this play": a short, plain-language explanation
-- of what each named player does in a shared play, written at their reading age.
--
-- ONE artefact per play (kind 'play_roles', subject_type 'play', subject_id =
-- tactic_plays.id) holding an entry per player in data.roles, rather than a row
-- per (play, player): one model call, one coach approval, one supersede.
--
-- Two fixed CHECK lists from 045 are widened, so this is not a code-only change:
--   * ai_artefacts_kind_check         + 'play_roles'
--   * ai_artefacts_subject_type_check + 'play'
-- The kind list below is the FULL list including 'scouting_report' (048), so
-- running 049 whether or not 048 has run leaves the constraint correct.
--
-- Safeguarding: text is shown to players only once a coach has approved it, and
-- the policy below enforces that in the database, not just in the app. A player
-- can read it only for a play that is shared with a team they are an active
-- member of. Staff already have ai_artefacts_staff_all.
--
-- Safe to re-run: constraints are dropped by name if present then re-added; the
-- policy is dropped if present then re-created. Existing rows all carry old
-- kinds and subject types, so ADD CONSTRAINT validates cleanly.

BEGIN;

ALTER TABLE ai_artefacts DROP CONSTRAINT IF EXISTS ai_artefacts_kind_check;
ALTER TABLE ai_artefacts ADD CONSTRAINT ai_artefacts_kind_check
  CHECK (kind IN (
    'development_plan',
    'development_plan_shared',
    'player_insights',
    'academy_health',
    'match_plan',
    'session_plan',
    'parent_report',
    'match_report',
    'scouting_report',
    'play_roles'));

ALTER TABLE ai_artefacts DROP CONSTRAINT IF EXISTS ai_artefacts_subject_type_check;
ALTER TABLE ai_artefacts ADD CONSTRAINT ai_artefacts_subject_type_check
  CHECK (subject_type IN ('player','fixture','team','academy','play'));

DROP POLICY IF EXISTS "ai_artefacts_play_roles_player_read" ON ai_artefacts;
CREATE POLICY "ai_artefacts_play_roles_player_read" ON ai_artefacts
  FOR SELECT TO authenticated
  USING (
    kind = 'play_roles'
    AND subject_type = 'play'
    AND status = 'approved'
    AND superseded_at IS NULL
    AND EXISTS (
      SELECT 1
        FROM tactic_plays tp
        JOIN team_members tm ON tm.team_id = tp.team_id AND tm.active
        JOIN players pl      ON pl.id = tm.player_id
       WHERE tp.id = ai_artefacts.subject_id
         AND tp.shared
         AND pl.profile_id = auth.uid()
    )
  );

COMMIT;

-- Verify with:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname IN ('ai_artefacts_kind_check','ai_artefacts_subject_type_check');
--   -- kind list ends in 'scouting_report','play_roles'; subject list ends in 'play'
--   SELECT policyname FROM pg_policies WHERE tablename = 'ai_artefacts';
--   -- includes ai_artefacts_play_roles_player_read

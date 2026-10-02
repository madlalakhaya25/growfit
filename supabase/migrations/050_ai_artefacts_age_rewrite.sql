-- 050_ai_artefacts_age_rewrite.sql
--
-- Phase 3 step 3.8: a coach's note rewritten for a child of a given age, cached
-- so the same note rewritten twice costs one model call.
--
-- Cached as an ai_artefacts row of kind 'age_rewrite'. The subject is the TEXT
-- itself: subject_type 'text', subject_id a deterministic UUID derived from
-- sha256(age + the note). subject_id is polymorphic with no foreign key (045),
-- so this needs no table of its own. Rows are staff-only: the existing
-- ai_artefacts_staff_all policy is the whole story, and no player or parent
-- policy is added. A rewrite is a draft the coach reads and chooses to use.
--
-- Two fixed CHECK lists are widened, so this is not a code-only change. Both
-- lists below are the FULL lists including 048's 'scouting_report' and 049's
-- 'play_roles' / 'play', so 050 is correct whichever of those have run.
--
-- Safe to re-run: constraints are dropped by name if present, then re-added.

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
    'play_roles',
    'age_rewrite'));

ALTER TABLE ai_artefacts DROP CONSTRAINT IF EXISTS ai_artefacts_subject_type_check;
ALTER TABLE ai_artefacts ADD CONSTRAINT ai_artefacts_subject_type_check
  CHECK (subject_type IN ('player','fixture','team','academy','play','text'));

COMMIT;

-- Verify with:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname IN ('ai_artefacts_kind_check','ai_artefacts_subject_type_check');
--   -- kind list ends in 'play_roles','age_rewrite'; subject list ends in 'play','text'

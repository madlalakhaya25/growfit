-- 048_ai_artefacts_scouting_kind.sql
--
-- Phase 2 step 2.5 adds the `scouting_report` artefact kind (an AI-written
-- opponent report, cached 24h per fixture). `ai_artefacts.kind` is a fixed
-- CHECK list from migration 045, so a new kind is NOT a code-only change:
-- without this, saveAiArtefact's insert violates the constraint, is reported
-- as a warning and swallowed, and the feature appears to work while never
-- persisting (every request then regenerates and bills the Gemini key again).
--
-- Numbering: 046 and 047 are reserved by docs/BACKLOG.md Phase 5.
--
-- Safe to re-run: the constraint is dropped by name if present, then re-added
-- with the full list. Existing rows all carry one of the original eight kinds,
-- so ADD CONSTRAINT validates cleanly.

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
    'scouting_report'));

COMMIT;

-- Verify with:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'ai_artefacts_kind_check';
--   -- expect the list above, ending in 'scouting_report'

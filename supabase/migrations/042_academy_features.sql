-- Per-academy feature toggles (docs/AI_FEATURES_AND_IA.md Part 4).
--
-- The navigation rebuild groups routes into a handful of sections per role.
-- A small academy running only the basics (no tactics board, no film
-- review yet) should be able to hide what it doesn't use instead of
-- carrying every section regardless. One jsonb column, keyed by a stable
-- feature name, does this without a schema change every time a new
-- toggle is needed.

BEGIN;

ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN academies.features IS
  'Per-academy feature toggles, e.g. {"tactics": false}. Absent key means '
  'on -- see src/lib/features.ts DEFAULT_FEATURES. Never a source of truth '
  'for anything safeguarding- or compliance-related; those stay always on.';

COMMIT;

-- Safe to re-run: the column is added IF NOT EXISTS.
--
-- Verify with:
--   SELECT id, name, features FROM academies LIMIT 5;
-- Expect every existing academy to show '{}' (nothing hidden yet).

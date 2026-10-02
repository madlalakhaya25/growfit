-- 052_drill_details.sql
--
-- A generated drill's full plan (setup, instructions, coaching points, length,
-- and its pitch diagram) used to be squeezed into the 500-character
-- `description` column and the diagram thrown away on save. This adds a
-- nullable JSON column beside it so the whole plan is kept.
--
-- Additive only: no existing row changes, no policy changes (the column sits
-- under the table's existing row-level policies), no index. The app validates
-- and size-caps the value before writing (lib/drill-details.ts) and falls back
-- to `description` for any drill whose `details` is null or unusable.
--
-- Safe to re-run: IF NOT EXISTS.

ALTER TABLE training_drills ADD COLUMN IF NOT EXISTS details JSONB;

-- To verify after running: the column exists, and every existing row is null.
--   information_schema.columns for training_drills shows details / jsonb.
--   count of training_drills rows with details not null is 0.

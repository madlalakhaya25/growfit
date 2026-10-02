-- 057_training_effort.sql
--
-- How hard a child found a training session (Borg CR-10, 1 to 10), recorded by
-- the coach after training. Feeds the squad readiness figure (load over the last
-- week against the last month). Nullable: most rows will never have one, and the
-- app treats a missing value as "not rated", never as zero effort.
--
-- Additive only: one nullable column on an existing table. No policy changes:
-- the existing training_attendance policies already decide who can read and
-- write a row, and effort is no more sensitive than the attendance mark beside it.

ALTER TABLE training_attendance
  ADD COLUMN IF NOT EXISTS rpe smallint;

ALTER TABLE training_attendance
  DROP CONSTRAINT IF EXISTS training_attendance_rpe_range;
ALTER TABLE training_attendance
  ADD CONSTRAINT training_attendance_rpe_range CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10);

NOTIFY pgrst, 'reload schema';

-- Repair: the expanded player_attributes columns (migration 013) are missing
-- from the live project, or present but absent from PostgREST's schema cache.
--
-- Symptom: saving a player assessment fails with
--   "Could not find the 'agility' column of 'player_attributes' in the schema cache"
-- (PostgREST PGRST204), and the coach's attribute sliders all read 50 because
-- the wide SELECT on the squad page errors with 42703 instead of returning a row.
--
-- Migrations in this repo are checked in but never auto-applied (see
-- web/CLAUDE.md), so 013 can simply have been missed. This file re-applies it
-- idempotently and then reloads the schema cache, which covers both causes.
-- Safe to run repeatedly.

ALTER TABLE player_attributes
  ADD COLUMN IF NOT EXISTS ball_control   smallint CHECK (ball_control   BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS crossing       smallint CHECK (crossing       BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS heading        smallint CHECK (heading        BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS tackling       smallint CHECK (tackling       BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS finishing      smallint CHECK (finishing      BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS first_touch    smallint CHECK (first_touch    BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS stamina        smallint CHECK (stamina        BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS agility        smallint CHECK (agility        BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS jumping        smallint CHECK (jumping        BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS strength       smallint CHECK (strength       BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS positioning    smallint CHECK (positioning    BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS decision_making smallint CHECK (decision_making BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS composure      smallint CHECK (composure      BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS work_rate      smallint CHECK (work_rate      BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS leadership     smallint CHECK (leadership     BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS shot_stopping  smallint CHECK (shot_stopping  BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS reflexes       smallint CHECK (reflexes       BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS distribution   smallint CHECK (distribution   BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS handling       smallint CHECK (handling       BETWEEN 1 AND 99);

-- Bust PostgREST's cached schema so the new columns are visible to the API
-- immediately. Without this the columns exist in Postgres but every write
-- naming one still returns PGRST204 until the API container next restarts.
NOTIFY pgrst, 'reload schema';

-- Verification (run separately; should return 25 rows):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'player_attributes'
--     AND column_name NOT IN ('id','player_id','coach_id','notes','assessed_at')
--   ORDER BY column_name;

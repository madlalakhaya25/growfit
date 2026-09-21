-- BUG: coaches cannot mark training attendance at all, and the three places
-- that read it disagree about what the values mean.
--
-- `training_attendance.status` still carries the constraint from migration
-- 005, written when this table was a player-facing RSVP:
--
--     status TEXT NOT NULL CHECK (status IN ('attending', 'unavailable'))
--
-- Migration 012 repurposed the table for coach-marked registers ("COACH
-- ATTENDANCE MARKING (per training session, replaces RSVP-only)") and added
-- marked_by / marked_at / note — but never touched the CHECK. The app was
-- written to the new purpose and writes 'present' / 'absent'
-- (`markTrainingAttendance`), so every single write fails with
--
--     23514 new row for relation "training_attendance" violates check
--           constraint "training_attendance_status_check"
--
-- Nothing surfaces that as "this needs a migration" — it arrives as a
-- generic save failure — so training attendance has been silently
-- unrecordable, which means:
--
--   * the welfare page flags EVERY player in the academy, because the
--     denominator counts sessions and the numerator can never be above zero;
--   * the AI squad brief reports everyone below the 75% policy threshold;
--   * the squad page's "Below 75%" filter matches the whole squad.
--
-- The readers disagree too. welfare.ts counts `status = 'present'` (matching
-- what the app tries to write); squad-context.ts and the coach squad page
-- count `status = 'attending'` (matching the old RSVP vocabulary). So even
-- with the constraint fixed, two of the three surfaces would read zero.
--
-- Separately, the policy the academy actually adopted is P/A/L/E — present,
-- absent, late, excused — and `match_attendance` (migration 012) already has
-- exactly that. Only the training side was left on the two-value RSVP set,
-- so "late" and "excused" had nowhere to go and registered as absences
-- against the 75% threshold.
--
-- Fix: bring training_attendance in line with match_attendance, and migrate
-- the legacy RSVP rows to the vocabulary everything else uses.

BEGIN;

-- 1. Translate any legacy RSVP rows. 'attending' was a player saying they
--    would be there and is the closest thing to a present mark;
--    'unavailable' was them saying they would not be, which is an absence
--    the coach knew about in advance — i.e. excused, not a plain absence.
--    Doing this BEFORE swapping the constraint, so neither value is ever
--    illegal mid-transaction.
UPDATE training_attendance SET status = 'present'  WHERE status = 'attending';
UPDATE training_attendance SET status = 'excused'  WHERE status = 'unavailable';

-- 2. Swap the constraint for the one match_attendance already uses.
--    Named explicitly rather than relying on Postgres' generated name, which
--    differs depending on whether the table was created by 005 or restored
--    from a dump.
ALTER TABLE training_attendance
  DROP CONSTRAINT IF EXISTS training_attendance_status_check;

ALTER TABLE training_attendance
  ADD CONSTRAINT training_attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused'));

COMMIT;

-- Safe to re-run: the UPDATEs match nothing once applied, and the constraint
-- is dropped by name before being re-added.
--
-- Verify with:
--   SELECT status, count(*) FROM training_attendance GROUP BY status;
-- Expect only present / absent / late / excused.

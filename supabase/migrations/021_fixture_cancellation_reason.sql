-- 021_fixture_cancellation_reason.sql
--
-- Cancelling a fixture recorded nothing about why. A parent or player just
-- sees "Cancelled" with no explanation — rained off, opponent withdrew,
-- ground unavailable, academy shortage — and has no way to find out short of
-- asking someone directly. Coaches had no field to put a reason in either.

ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

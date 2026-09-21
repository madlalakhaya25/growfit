-- Player injury / availability state (docs/BACKLOG.md 1.2).
--
-- There was no way to record that a player is currently injured. Squad
-- selection (the coach picking a starting XI by hand, and the AI's own
-- suggestLineup/generateMatchPlan) treated every registered player as
-- equally available -- the AI's own system prompt already says "never
-- suggest playing an injured or unwell child," but nothing fed it the one
-- fact it would need to honour that.

BEGIN;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_note TEXT
    CHECK (availability_note IS NULL OR char_length(availability_note) <= 200),
  ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS availability_updated_by UUID REFERENCES profiles(id);

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_availability_status_check;

ALTER TABLE players
  ADD CONSTRAINT players_availability_status_check
  CHECK (availability_status IN ('available', 'injured', 'unavailable'));

-- No new RLS policy needed: these are ordinary columns on `players`, and the
-- existing `player_staff_update` policy (academy_id = auth_academy_id() AND
-- is_admin_or_coach()) already governs writes to the row exactly as it does
-- for every other player field -- Postgres RLS is row-level, not
-- column-level, and this row is already covered.

COMMIT;

-- Safe to re-run: columns are added IF NOT EXISTS, and the constraint is
-- dropped by name before being re-added.
--
-- Verify with:
--   SELECT availability_status, count(*) FROM players GROUP BY availability_status;
-- Expect every existing player defaulted to 'available'.

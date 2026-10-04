-- 065_academy_drill_library.sql
--
-- One academy method across U11, U13 and U15: the drill library (migration
-- 012) gets the tags a coach needs to find the right drill for their age group
-- and the theme they are working on, plus a curated "Academy method" flag the
-- director sets.
--
--   * age_groups       — which of U11 / U13 / U15 the drill suits (any of them).
--   * themes           — what it trains, from a fixed list aligned to the
--                        4-corner model and the phases of play.
--   * four_corner      — the FIFA 4-corner category the drill mainly serves.
--   * players_needed   — how many players it needs (1 to 40).
--   * equipment        — free text ("8 cones, 4 bibs, 6 balls").
--   * coaching_points  — the key points the coach repeats.
--   * tactic_play_id   — optional saved board play used as the drill's diagram.
--   * source_drill_id  — the session drill it was shared from, so the same
--                        session drill is not shared twice.
--   * is_academy_method — curated by an admin; sorts first with a badge.
--
-- No children's data: drills describe exercises, never players.
--
-- Curation is admin-only. The existing write policy
-- (`coaches_admins_manage_drill_library`, migration 012) lets any coach or
-- admin of the academy write a drill, which is right for everything else, so a
-- trigger guards the one flag: only an admin may set or clear it, and only an
-- admin may edit or delete a drill once it is the academy method.
--
-- The app tolerates every column being absent (42703 / PGRST204), so the code
-- can deploy before this runs. Safe to re-run.

BEGIN;

ALTER TABLE drill_library
  ADD COLUMN IF NOT EXISTS age_groups        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS themes            TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS four_corner       TEXT,
  ADD COLUMN IF NOT EXISTS players_needed    SMALLINT,
  ADD COLUMN IF NOT EXISTS equipment         TEXT,
  ADD COLUMN IF NOT EXISTS coaching_points   TEXT,
  ADD COLUMN IF NOT EXISTS tactic_play_id    UUID REFERENCES tactic_plays(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_drill_id   UUID REFERENCES training_drills(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_academy_method BOOLEAN NOT NULL DEFAULT false;

-- CHECK constraints by name, so a re-run does not add a second copy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_age_groups_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_age_groups_check
      CHECK (age_groups <@ ARRAY['U11','U13','U15']::TEXT[]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_themes_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_themes_check
      CHECK (themes <@ ARRAY[
        'passing','receiving','dribbling','finishing','defending',
        'pressing','transitions','set_pieces','fitness','mental'
      ]::TEXT[]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_four_corner_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_four_corner_check
      CHECK (four_corner IS NULL OR four_corner IN ('technical','tactical','physical','psychological'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_players_needed_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_players_needed_check
      CHECK (players_needed IS NULL OR players_needed BETWEEN 1 AND 40);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_equipment_len_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_equipment_len_check
      CHECK (equipment IS NULL OR char_length(equipment) <= 300);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drill_library_coaching_points_len_check') THEN
    ALTER TABLE drill_library ADD CONSTRAINT drill_library_coaching_points_len_check
      CHECK (coaching_points IS NULL OR char_length(coaching_points) <= 1000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drill_library_age_groups ON drill_library USING GIN (age_groups);
CREATE INDEX IF NOT EXISTS idx_drill_library_themes     ON drill_library USING GIN (themes);
CREATE INDEX IF NOT EXISTS idx_drill_library_source     ON drill_library (source_drill_id);

-- Only an admin curates the academy method.
CREATE OR REPLACE FUNCTION drill_library_guard_curation()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Service-role and SQL-editor writes have no auth.uid(); let them through.
  IF auth.uid() IS NULL OR auth_role() = 'admin' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_academy_method THEN
      RAISE EXCEPTION 'Only an admin can mark a drill as the academy method.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_academy_method THEN
      RAISE EXCEPTION 'Only an admin can change an academy method drill.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- A coach deleting their own saved play or session drill nulls the link on
  -- a curated drill through ON DELETE SET NULL; that must not be blocked.
  IF OLD.is_academy_method
     AND (to_jsonb(NEW) - 'tactic_play_id' - 'source_drill_id')
         IS DISTINCT FROM (to_jsonb(OLD) - 'tactic_play_id' - 'source_drill_id') THEN
    RAISE EXCEPTION 'Only an admin can change an academy method drill.' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_academy_method IS DISTINCT FROM OLD.is_academy_method THEN
    RAISE EXCEPTION 'Only an admin can mark a drill as the academy method.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drill_library_guard_curation ON drill_library;
CREATE TRIGGER drill_library_guard_curation
  BEFORE INSERT OR UPDATE OR DELETE ON drill_library
  FOR EACH ROW EXECUTE FUNCTION drill_library_guard_curation();

COMMIT;

-- To verify after running:
--   information_schema.columns for drill_library lists the nine new columns.
--   As a coach: UPDATE drill_library SET is_academy_method = true ... fails 42501.
--   As an admin of the same academy: the same update succeeds.
--   INSERT with age_groups = '{U9}' fails 23514.

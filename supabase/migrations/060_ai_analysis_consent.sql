-- 060_ai_analysis_consent.sql
--
-- Step 5.0, the human half. The photo and media consent covers photos and video
-- on the academy's own channels; it does not cover footage being analysed by an
-- automated tool run by a third party. This adds a separate, optional consent
-- for that, and makes the footage gate (059) require it as well.
--
-- Additive: one column, default false, so every existing child starts without
-- the consent and a parent opts in. Declining affects nothing else. The
-- function keeps its signature and its fail-closed rules, and now also lists a
-- child whose ai_analysis_consent on the season's row is not true.

BEGIN;

ALTER TABLE player_consents
  ADD COLUMN IF NOT EXISTS ai_analysis_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION clip_consent_gaps(p_player_ids UUID[], p_season TEXT)
RETURNS UUID[]
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(array_agg(DISTINCT wanted.id), ARRAY[]::UUID[])
  FROM unnest(p_player_ids) AS wanted(id)
  WHERE NOT is_admin_or_coach()
     OR NOT EXISTS (
       SELECT 1
       FROM players p
       JOIN player_consents c ON c.player_id = p.id
       WHERE p.id = wanted.id
         AND p.academy_id = auth_academy_id()
         AND c.season = p_season
         AND c.photo_consent IS TRUE
         AND c.ai_analysis_consent IS TRUE
     );
$$;

REVOKE ALL ON FUNCTION clip_consent_gaps(UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clip_consent_gaps(UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Safe to re-run. To verify, as a signed-in coach, a child with photo consent
-- but no ai_analysis_consent should be returned by:
--   select clip_consent_gaps(array['<player id>'::uuid], '2026');

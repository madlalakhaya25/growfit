-- 059_clip_consent_check.sql
--
-- Step 5.0, the consent gate. Before any footage of children is analysed, every
-- child shown must have photo and media consent for the current season. This
-- function answers "which of these children do NOT" so that the check lives in
-- the database, where a later screen or action cannot forget or skip it. It is
-- the same pattern as get_public_passport (023), which enforces photo consent
-- inside the function rather than at the call site.
--
-- Additive only: one new function, no table changes. Nothing calls it until a
-- video feature exists, so applying it changes nothing for coaches or families.
--
-- Fails closed. A child is reported as a gap when:
--   * the caller is not an admin or coach (everyone is a gap), or
--   * the child is not in the caller's academy, or
--   * the child has no consent row for the season, or
--   * photo_consent on that row is not true.
-- It returns only ids, never any consent detail.

BEGIN;

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
     );
$$;

REVOKE ALL ON FUNCTION clip_consent_gaps(UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clip_consent_gaps(UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Safe to re-run. To verify, as a signed-in coach:
--   select clip_consent_gaps(array['<a player id with consent>'::uuid, '<one without>'::uuid], '2026');
-- should return only the id without consent for that season.

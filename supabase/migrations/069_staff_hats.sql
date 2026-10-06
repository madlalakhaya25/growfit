-- 069_staff_hats.sql
--
-- Staff "hats" (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md, Part 2):
-- an optional title on a staff member, such as director or safeguarding, that
-- only chooses which cards appear on their Today page. A hat gives NO extra data
-- access: the four database roles stay as they are, so there is no new row
-- security to get wrong. Someone with two hats sees both sets of cards.
--
--   staff_hats   one row per (person, hat)
--
-- Who can do what:
--   * admins of the academy read, add and remove hats for people of that academy;
--   * each person reads their own hats;
--   * nobody else sees anything. No children's data is stored here.
--
-- The app tolerates this migration being absent (PGRST205 / 42P01): every
-- person then sees the cards they see today. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS staff_hats (
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  academy_id UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  hat        TEXT        NOT NULL CHECK (hat IN (
    'director', 'technical_director', 'safeguarding', 'finance',
    'fundraising', 'registration', 'equipment'
  )),
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, hat)
);

CREATE INDEX IF NOT EXISTS staff_hats_academy_idx ON staff_hats (academy_id);

-- "Is the caller an admin of this academy" already exists from 068; repeated so
-- this file stands alone.
CREATE OR REPLACE FUNCTION is_academy_admin(p_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_academy_id = auth_academy_id() AND auth_role() = 'admin';
$$;

ALTER TABLE staff_hats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_hats_read_own_or_admin" ON staff_hats;
DROP POLICY IF EXISTS "staff_hats_admin_insert"      ON staff_hats;
DROP POLICY IF EXISTS "staff_hats_admin_delete"      ON staff_hats;

CREATE POLICY "staff_hats_read_own_or_admin" ON staff_hats
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR is_academy_admin(academy_id));

-- The person must belong to the same academy and be staff (a coach or admin).
CREATE POLICY "staff_hats_admin_insert" ON staff_hats
  FOR INSERT TO authenticated
  WITH CHECK (
    is_academy_admin(academy_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = staff_hats.profile_id
         AND p.academy_id = staff_hats.academy_id
         AND p.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "staff_hats_admin_delete" ON staff_hats
  FOR DELETE TO authenticated
  USING (is_academy_admin(academy_id));

COMMIT;

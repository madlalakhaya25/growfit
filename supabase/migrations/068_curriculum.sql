-- 068_curriculum.sql
--
-- The academy's own curriculum (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md,
-- Part 1): what the academy teaches, per age group, in its own words, grouped
-- under the five development categories already in the app. Growfit FA's list
-- is the first one; any academy can write its own.
--
--   curriculum_items   one row per thing taught (age group, category, title)
--   curriculum_links   what was done about it: a session, a drill, an
--                      objective or a milestone, so coverage can be counted
--                      from data coaches already enter
--
-- Nothing existing changes. The old milestone categories, drill categories and
-- attributes stay as they are; the curriculum sits above them.
--
-- Who can do what:
--   * curriculum_items: staff of the academy (coaches and admins) read; only
--     admins write. Parents and players have no access at first.
--   * curriculum_links: staff of the academy read and write, so a coach can say
--     "this session was about that item".
--
-- No children's data: items describe what is taught, never a player.
--
-- The app tolerates this migration being absent (PGRST205 / 42P01), so the code
-- can deploy before it runs. Safe to re-run: IF NOT EXISTS / DROP ... IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS curriculum_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  age_group   TEXT        NOT NULL CHECK (char_length(age_group) BETWEEN 2 AND 12),
  category    TEXT        NOT NULL CHECK (category IN ('technical', 'tactical', 'physical', 'mental', 'leadership')),
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT        CHECK (description IS NULL OR char_length(description) <= 600),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The same item is not written twice for an age group and category.
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_items_unique_title_idx
  ON curriculum_items (academy_id, age_group, category, lower(title));

CREATE INDEX IF NOT EXISTS curriculum_items_group_idx
  ON curriculum_items (academy_id, age_group, category, sort_order);

CREATE TABLE IF NOT EXISTS curriculum_links (
  item_id    UUID        NOT NULL REFERENCES curriculum_items(id) ON DELETE CASCADE,
  link_type  TEXT        NOT NULL CHECK (link_type IN ('session', 'drill', 'objective', 'milestone')),
  link_id    UUID        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, link_type, link_id)
);

CREATE INDEX IF NOT EXISTS curriculum_links_target_idx
  ON curriculum_links (link_type, link_id);

-- "Is the caller staff of this academy": a coach or an admin of it.
CREATE OR REPLACE FUNCTION is_academy_staff(p_academy_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_academy_id = auth_academy_id() AND auth_role() IN ('admin', 'coach');
$$;

ALTER TABLE curriculum_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_items_staff_read"   ON curriculum_items;
DROP POLICY IF EXISTS "curriculum_items_admin_write"  ON curriculum_items;
DROP POLICY IF EXISTS "curriculum_items_admin_update" ON curriculum_items;
DROP POLICY IF EXISTS "curriculum_items_admin_delete" ON curriculum_items;

CREATE POLICY "curriculum_items_staff_read" ON curriculum_items
  FOR SELECT TO authenticated
  USING (is_academy_staff(academy_id));

CREATE POLICY "curriculum_items_admin_write" ON curriculum_items
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND academy_id = auth_academy_id()
    AND auth_role() = 'admin'
  );

CREATE POLICY "curriculum_items_admin_update" ON curriculum_items
  FOR UPDATE TO authenticated
  USING (academy_id = auth_academy_id() AND auth_role() = 'admin')
  WITH CHECK (academy_id = auth_academy_id() AND auth_role() = 'admin');

CREATE POLICY "curriculum_items_admin_delete" ON curriculum_items
  FOR DELETE TO authenticated
  USING (academy_id = auth_academy_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "curriculum_links_staff_all" ON curriculum_links;

CREATE POLICY "curriculum_links_staff_all" ON curriculum_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_items i
       WHERE i.id = curriculum_links.item_id AND is_academy_staff(i.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_items i
       WHERE i.id = curriculum_links.item_id AND is_academy_staff(i.academy_id)
    )
  );

COMMIT;

-- 053_academy_terms.sql
--
-- The app has no idea what a "term" is: the attendance policy and the term
-- report both talk about terms, but a term has only ever been implied. Stage 3's
-- term review needs real dates to review against, so an academy now keeps its
-- own list of terms (name + start + end), set up by an admin.
--
-- Additive only: a new table, nothing existing changes. Read by every member of
-- the academy (a parent's report names the term), written by admins only.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS academy_terms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  starts_on   DATE NOT NULL,
  ends_on     DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (academy_id, starts_on)
);

CREATE INDEX IF NOT EXISTS academy_terms_academy_start_idx
  ON academy_terms (academy_id, starts_on);

ALTER TABLE academy_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "terms_academy_read"  ON academy_terms;
DROP POLICY IF EXISTS "terms_admin_write"   ON academy_terms;

CREATE POLICY "terms_academy_read" ON academy_terms
  FOR SELECT TO authenticated
  USING (academy_id = auth_academy_id());

CREATE POLICY "terms_admin_write" ON academy_terms
  FOR ALL TO authenticated
  USING (academy_id = auth_academy_id() AND auth_role() = 'admin')
  WITH CHECK (academy_id = auth_academy_id() AND auth_role() = 'admin');

COMMIT;

-- To verify after running: the table exists with RLS on and two policies.
--   select count(*) from academy_terms;  -- 0
--   select policyname from pg_policies where tablename = 'academy_terms';

-- profiles.id is already the primary key, so auth_role() and
-- auth_academy_id() (both `SELECT ... FROM profiles WHERE id = auth.uid()`)
-- already hit an index for the lookup itself. What they don't get from the
-- PK alone is an index-only scan: role and academy_id still require a heap
-- fetch. Both helper functions run on essentially every RLS-guarded query
-- in the app, so a covering index lets Postgres answer them straight from
-- the index without touching the table.
CREATE INDEX IF NOT EXISTS idx_profiles_id_role_academy
  ON profiles(id, role, academy_id);

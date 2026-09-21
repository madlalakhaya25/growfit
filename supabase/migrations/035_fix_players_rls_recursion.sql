-- BUG: every read of `players` by any authenticated role fails with
-- `42P17 infinite recursion detected in policy for relation "players"`.
--
-- Confirmed live in production (Vercel function log, coach squad page):
--   [squad page] failed to load team_members: {
--     code: '42P17', message: 'infinite recursion detected in policy for
--     relation "players"'
--   }
-- Reproduced locally against a real Postgres 16 instance: a bare
-- `SELECT * FROM players WHERE id = ...` as the `authenticated` role, with
-- no other tables involved in the query text at all, throws the same error.
-- This is not limited to the squad page — anything that reads `players`
-- under RLS is affected (player dashboard, admin player pages, parent
-- dashboard, …).
--
-- Root cause: migration 032 introduced a two-way cycle between `players`
-- and `parent_player_links`'s RLS policies.
--
--   players.player_parent_read (SELECT, from 001_schema.sql) —
--     EXISTS (SELECT 1 FROM parent_player_links WHERE parent_id = auth.uid()
--             AND player_id = players.id)
--   parent_player_links.parent_link_admin (FOR ALL, from 032) —
--     EXISTS (SELECT 1 FROM players p WHERE p.id = parent_player_links.player_id
--             AND p.academy_id = auth_academy_id())
--
-- Reading `players` can evaluate `player_parent_read`, which queries
-- `parent_player_links`, which (being a FOR ALL policy, so it applies to
-- SELECT too) evaluates `parent_link_admin`, which queries `players` again
-- — re-entering RLS on `players`, including `player_parent_read` again.
-- Postgres detects the cycle and raises 42P17 rather than looping forever.
-- `parent_link_staff_insert` (FOR INSERT) has the identical inline
-- `EXISTS (SELECT 1 FROM players p WHERE ...)` shape and would cause the
-- same recursion the moment anything ever reads `parent_player_links` from
-- inside evaluating a `players` policy in an INSERT/UPDATE context.
--
-- None of the schema's OTHER cross-table policy checks have this shape —
-- they all go through a SECURITY DEFINER helper (`auth_academy_id()`,
-- `is_admin_or_coach()`, `is_team_coach()`) that queries `profiles` or
-- `team_coaches`, never `players` itself, so nothing else closes a loop
-- back to `players`. These two policies broke that convention by inlining
-- a raw subquery against `players` directly in the policy body, which runs
-- under the QUERYING role's own RLS rather than bypassing it.
--
-- Fix: move the "is this player in my academy" check into a SECURITY
-- DEFINER function, same pattern as every other cross-table check in this
-- schema. A SECURITY DEFINER function's body executes as the function's
-- owner (the table owner, which bypasses RLS on its own tables) rather
-- than as the calling role, so its internal SELECT against `players` never
-- re-enters `players`' own RLS policies — breaking the cycle.
--
-- Idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION player_academy_matches(p_player_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND academy_id = auth_academy_id()
  );
$$;

DROP POLICY IF EXISTS "parent_link_staff_insert" ON parent_player_links;
CREATE POLICY "parent_link_staff_insert" ON parent_player_links FOR INSERT
  WITH CHECK (
    auth_role() IN ('admin', 'coach')
    AND player_academy_matches(parent_player_links.player_id)
  );

DROP POLICY IF EXISTS "parent_link_admin" ON parent_player_links;
CREATE POLICY "parent_link_admin" ON parent_player_links FOR ALL
  USING (
    auth_role() = 'admin'
    AND player_academy_matches(parent_player_links.player_id)
  )
  WITH CHECK (
    auth_role() = 'admin'
    AND player_academy_matches(parent_player_links.player_id)
  );

NOTIFY pgrst, 'reload schema';

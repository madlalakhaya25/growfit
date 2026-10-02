-- 054_player_term_reviews.sql
--
-- Term review with history. Once a term a coach places each player in a band
-- (1 Emerging, 2 Developing, 3 Secure, 4 Excelling) for each of the five
-- development categories. One row per (player, term, category), so last term's
-- review stays put when this term's is written, and "growth since last term"
-- is a comparison of two rows rather than something remembered.
--
-- Additive only: a new table. Needs 053 (academy_terms).
--
-- Who can read: staff of the player's academy; the player; their linked
-- parents. A band is the same fact for all of them. The coach's private notes
-- are NOT stored here, on purpose (row-level security cannot hide one column).
-- Who can write: staff of the player's academy only.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS player_term_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  term_id     UUID NOT NULL REFERENCES academy_terms(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('technical','tactical','physical','mental','leadership')),
  band        SMALLINT NOT NULL CHECK (band BETWEEN 1 AND 4),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, term_id, category)
);

CREATE INDEX IF NOT EXISTS player_term_reviews_player_idx ON player_term_reviews (player_id, term_id);

ALTER TABLE player_term_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "term_reviews_staff_all"    ON player_term_reviews;
DROP POLICY IF EXISTS "term_reviews_player_read"  ON player_term_reviews;
DROP POLICY IF EXISTS "term_reviews_parent_read"  ON player_term_reviews;

CREATE POLICY "term_reviews_staff_all" ON player_term_reviews
  FOR ALL TO authenticated
  USING (
    is_admin_or_coach()
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
  )
  WITH CHECK (
    is_admin_or_coach()
    AND player_id IN (SELECT id FROM players WHERE academy_id = auth_academy_id())
    AND term_id IN (SELECT id FROM academy_terms WHERE academy_id = auth_academy_id())
  );

CREATE POLICY "term_reviews_player_read" ON player_term_reviews
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

CREATE POLICY "term_reviews_parent_read" ON player_term_reviews
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT player_id FROM parent_player_links WHERE parent_id = auth.uid()));

COMMIT;

-- To verify after running: the table exists, RLS is on, three policies.
--   select policyname from pg_policies where tablename = 'player_term_reviews';

-- 016_play_links_and_tags.sql
--
-- Makes saved plays findable and shareable:
--   * concept_ids  — tag a play with tactical concepts (ids from lib/tactics.ts)
--   * session_id / fixture_id — attach a play to a training session or a match
--   * share_token  — lets a player open the play on their phone
--   * shared       — only plays the coach has shared are visible to players

ALTER TABLE tactic_plays
  ADD COLUMN IF NOT EXISTS concept_ids TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_id  UUID    REFERENCES training_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fixture_id  UUID    REFERENCES fixtures(id)          ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS share_token TEXT    UNIQUE
    DEFAULT encode(gen_random_bytes(8), 'hex');

-- Backfill tokens for any play created before this migration.
UPDATE tactic_plays
SET    share_token = encode(gen_random_bytes(8), 'hex')
WHERE  share_token IS NULL;

CREATE INDEX IF NOT EXISTS tactic_plays_session_idx ON tactic_plays (session_id);
CREATE INDEX IF NOT EXISTS tactic_plays_fixture_idx ON tactic_plays (fixture_id);
CREATE INDEX IF NOT EXISTS tactic_plays_concepts_idx ON tactic_plays USING GIN (concept_ids);

-- ─────────────────────────────────────────
-- Public read for a shared play, by token
-- ─────────────────────────────────────────
-- SECURITY DEFINER so a player can open a play their coach shared without
-- needing a direct SELECT policy on the table. Only returns shared plays.

CREATE OR REPLACE FUNCTION get_shared_play(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_play RECORD;
BEGIN
  SELECT p.id, p.name, p.notes, p.data, p.concept_ids, t.name AS team_name, t.age_group
  INTO   v_play
  FROM   tactic_plays p
  JOIN   teams t ON t.id = p.team_id
  WHERE  p.share_token = lower(trim(p_share_token))
  AND    p.shared = TRUE;

  IF v_play.id IS NULL THEN
    RETURN json_build_object('error', 'Play not found or not shared.');
  END IF;

  RETURN json_build_object(
    'name',        v_play.name,
    'notes',       v_play.notes,
    'data',        v_play.data,
    'concept_ids', v_play.concept_ids,
    'team_name',   v_play.team_name,
    'age_group',   v_play.age_group
  );
END;
$$;

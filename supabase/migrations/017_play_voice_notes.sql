-- 017_play_voice_notes.sql
--
-- A coach can record a short voice note explaining a play. The audio itself
-- lives in the existing `academy-media` storage bucket; here we keep the public
-- URL and the storage path (so the file can be replaced or deleted later).
--
-- The note travels with the play, so a player opening a shared play hears the
-- coach's own voice alongside the animation.

ALTER TABLE tactic_plays
  ADD COLUMN IF NOT EXISTS voice_url  TEXT,
  ADD COLUMN IF NOT EXISTS voice_path TEXT;

-- Shared-play reader returns the voice note too.
CREATE OR REPLACE FUNCTION get_shared_play(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_play RECORD;
BEGIN
  SELECT p.id, p.name, p.notes, p.data, p.concept_ids, p.voice_url,
         t.name AS team_name, t.age_group
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
    'voice_url',   v_play.voice_url,
    'team_name',   v_play.team_name,
    'age_group',   v_play.age_group
  );
END;
$$;

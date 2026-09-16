-- 029_shared_play_notes_privacy.sql
--
-- get_shared_play() (016, extended by 017) returns a play's whole `data`
-- JSONB blob to anyone with the share link, unfiltered. That was fine while
-- `data` only ever held pitch/drawing state — but this session's tactics-
-- studio work added per-player coach notes (tactical-board.tsx's "Notes for
-- {player}" panel, saved into data.playerNotes), with UI copy that reads
-- "Shown to {player} in their own view of this play — real coaching
-- feedback, not just a diagram." That promise was never actually kept:
-- sharePlayToSquad() broadcasts one share token to the whole squad, and
-- PlayViewer rendered every note in data.playerNotes to whoever opened it —
-- individual coaching feedback about a minor became squad-wide reading.
-- Caught in review before this had a live database to reach; fixed here
-- rather than shipped and patched later.
--
-- The fix filters data.playerNotes down to only the notes about players the
-- calling user actually is (or, if a parent, is linked to) — everyone else
-- sees none. Coaches/admins see all of them, since they authored them and
-- it's their own team's data either way (RLS on tactic_plays already scopes
-- reads to the caller's academy).

CREATE OR REPLACE FUNCTION get_shared_play(p_share_token TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_play       RECORD;
  v_is_staff   BOOLEAN;
  v_player_ids UUID[];
  v_filtered   JSONB;
  v_data       JSONB;
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

  v_data := v_play.data;

  SELECT auth_role() IN ('coach', 'admin') INTO v_is_staff;

  IF NOT COALESCE(v_is_staff, FALSE) AND v_data ? 'playerNotes' THEN
    -- Every player the caller either is, or (as a parent) is linked to.
    SELECT array_agg(pid) INTO v_player_ids FROM (
      SELECT id        AS pid FROM players             WHERE profile_id = auth.uid()
      UNION
      SELECT player_id AS pid FROM parent_player_links  WHERE parent_id  = auth.uid()
    ) allowed;

    SELECT jsonb_agg(note) INTO v_filtered
    FROM   jsonb_array_elements(v_data->'playerNotes') note
    WHERE  (note->>'playerId')::uuid = ANY(COALESCE(v_player_ids, ARRAY[]::UUID[]));

    v_data := jsonb_set(v_data, '{playerNotes}', COALESCE(v_filtered, '[]'::jsonb));
  END IF;

  RETURN json_build_object(
    'name',        v_play.name,
    'notes',       v_play.notes,
    'data',        v_data,
    'concept_ids', v_play.concept_ids,
    'voice_url',   v_play.voice_url,
    'team_name',   v_play.team_name,
    'age_group',   v_play.age_group
  );
END;
$$;

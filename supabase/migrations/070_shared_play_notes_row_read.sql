-- 070_shared_play_notes_row_read.sql
--
-- Closes a hole that 029 left open. 029 made get_shared_play() show a player only
-- the coach notes about themselves, but 051 also lets a player SELECT the
-- tactic_plays row of a shared play directly, and row security cannot hide one
-- field of a row. So a player calling the API for tactic_plays.data could read
-- every teammate's private coaching notes (data.playerNotes).
--
-- The fix: players stop reading the table. Two SECURITY DEFINER functions give
-- them the only two things they read from it (the list of plays shared with their
-- team, and the share token of one shared play), neither returns `data`, and the
-- player read policy is dropped. Staff reads are unchanged. Opening a play still
-- goes through get_shared_play(), which filters the notes.
--
-- The app falls back to the old direct read when these functions do not exist, so
-- the code can ship before this runs; the hole closes when it runs. Safe to re-run.

BEGIN;

CREATE OR REPLACE FUNCTION list_my_shared_plays()
RETURNS TABLE (
  id uuid, name text, notes text, share_token text, concept_ids text[],
  voice_url text, updated_at timestamptz, team_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.name, p.notes, p.share_token, p.concept_ids, p.voice_url, p.updated_at, t.name
    FROM tactic_plays p
    JOIN teams t ON t.id = p.team_id
   WHERE p.shared
     AND p.team_id IN (
       SELECT tm.team_id
         FROM team_members tm
         JOIN players pl ON pl.id = tm.player_id
        WHERE tm.active AND pl.profile_id = auth.uid()
     )
   ORDER BY p.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION shared_play_token(p_play_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.share_token
    FROM tactic_plays p
   WHERE p.id = p_play_id
     AND p.shared
     AND p.team_id IN (
       SELECT tm.team_id
         FROM team_members tm
         JOIN players pl ON pl.id = tm.player_id
        WHERE tm.active AND pl.profile_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION list_my_shared_plays() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION shared_play_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_my_shared_plays() TO authenticated;
GRANT EXECUTE ON FUNCTION shared_play_token(uuid) TO authenticated;

DROP POLICY IF EXISTS "tactic_play_player_read_shared" ON tactic_plays;

COMMIT;

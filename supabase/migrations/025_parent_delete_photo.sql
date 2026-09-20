-- There was no delete path for a player's photo, or for a player record at
-- all — every other entity in the schema has one. This is the narrow first
-- piece: a parent (or the player themself, once claimed) can remove their
-- own child's photo without asking a developer to run a manual update.
--
-- A SECURITY DEFINER RPC rather than a bare RLS UPDATE policy, because RLS
-- can't restrict *which column* a grant covers — a parent with a general
-- UPDATE policy on players could edit anything on the row, not just the
-- photo. Same narrow-self-service shape as update_own_registration_numbers.
CREATE OR REPLACE FUNCTION delete_player_photo(p_player_id UUID)
RETURNS JSON LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_authorised BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM parent_player_links WHERE parent_id = auth.uid() AND player_id = p_player_id
  ) OR EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND profile_id = auth.uid()
  ) INTO v_authorised;

  IF NOT v_authorised THEN
    RETURN json_build_object('error', 'Not authorised to remove this photo.');
  END IF;

  UPDATE players SET photo_url = NULL WHERE id = p_player_id;

  RETURN json_build_object('success', true);
END;
$$;

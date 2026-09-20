-- POPIA's right to erasure needs an actual answer, not "ask a developer."
-- There was no DELETE policy on players at all — RLS defaults to deny any
-- operation with no matching policy, so nobody, including admins, could
-- delete a player row through the app. Every table that references
-- players.id already cascades (player_medical, player_consents,
-- player_documents, ratings, attributes, attendance, team_members,
-- parent_player_links, media_tags, welfare_checkins, etc.), so a single
-- DELETE here is a real, complete erasure of the player's record.
--
-- Scoped to admin, within their own academy — a full hard delete is
-- deliberately not self-service for a parent (a parent-triggered delete of
-- the wrong record is unrecoverable); the app-level flow requires typing
-- the player's name to confirm before this ever runs.
DROP POLICY IF EXISTS "player_admin_delete" ON players;
CREATE POLICY "player_admin_delete" ON players FOR DELETE
  USING (academy_id = auth_academy_id() AND auth_role() = 'admin');

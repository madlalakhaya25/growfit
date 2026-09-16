-- 028_film_surface.sql
--
-- Video/still telestration ("Match Film") reuses tactic_plays wholesale —
-- same JSONB `data` column, same RLS, same share/voice-note machinery —
-- rather than a new table, because a film breakdown is structurally the
-- same thing as a pitch play: a name, a coach, a team, drawn annotations,
-- an optional link to a fixture/session, an optional share token.
--
-- The one real gap: the coach tactics hub lists plays by team without ever
-- fetching the (potentially large — a freeze-framed still can be a few
-- hundred KB of embedded image data) `data` blob, so there needs to be a
-- cheap, indexed way to tell a pitch play from a film one without reading
-- that column. Everything else about a film play lives inside `data`
-- itself (data.surface = 'film', a source kind, and either an embedded
-- still or a source URL) — no further schema needed for that part, the
-- same reasoning that meant B1-B3's timeline/equipment/spotlight/notes
-- work needed no migration at all.

ALTER TABLE tactic_plays
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'pitch' CHECK (surface IN ('pitch', 'film'));

CREATE INDEX IF NOT EXISTS tactic_plays_surface_idx ON tactic_plays (team_id, surface);

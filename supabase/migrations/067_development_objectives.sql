-- 067_development_objectives.sql
--
-- Match -> Training -> Follow-up (docs/FEATURE_SPECS/match-to-training.md).
-- A coach names one problem from a match, plans training for it, and at the
-- next match records whether it got better. Two new tables; nothing existing
-- changes.
--
--   development_objectives       one row per objective: the problem, the
--                                objective, the status and the verdict
--   development_objective_links  what was done about it: sessions and plays
--
-- The table is deliberately generic (subject_type) so the same shape can later
-- hold player IDP objectives and coach development goals. This slice only
-- writes subject_type = 'team'.
--
-- Who can do what:
--   * coaches of the team (is_team_coach) and admins of the academy read and
--     write objectives for it;
--   * parents and players have NO access to these rows. Families only ever see
--     an approved, team-level line in the weekly note.
--   * nobody deletes except admins (mistakes). An objective is closed, not
--     removed, so the history survives a coach leaving.
--
-- Two guards in the database as well as the app: at most two open objectives
-- per team, and a closed objective must carry its closing time.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS development_objectives (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id           UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  subject_type         TEXT        NOT NULL DEFAULT 'team' CHECK (subject_type IN ('team')),
  subject_id           UUID        NOT NULL,
  source_type          TEXT        NOT NULL DEFAULT 'match' CHECK (source_type IN ('match', 'coach')),
  source_fixture_id    UUID                 REFERENCES fixtures(id) ON DELETE SET NULL,
  phase                TEXT        CHECK (phase IS NULL OR phase IN (
                                     'in_possession', 'out_of_possession',
                                     'attacking_transition', 'defensive_transition', 'set_pieces')),
  problem              TEXT        NOT NULL CHECK (char_length(problem) BETWEEN 1 AND 200),
  problem_key          TEXT        CHECK (problem_key IS NULL OR char_length(problem_key) BETWEEN 1 AND 60),
  detail               JSONB       CHECK (detail IS NULL OR jsonb_typeof(detail) = 'object'),
  objective            TEXT        NOT NULL CHECK (char_length(objective) BETWEEN 1 AND 200),
  status               TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  verdict              TEXT        CHECK (verdict IS NULL OR verdict IN ('improved', 'partly', 'not_yet')),
  follow_up_fixture_id UUID                 REFERENCES fixtures(id) ON DELETE SET NULL,
  closed_at            TIMESTAMPTZ,
  created_by           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status = 'open' OR closed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS development_objectives_subject_idx
  ON development_objectives (subject_type, subject_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS development_objective_links (
  objective_id UUID NOT NULL REFERENCES development_objectives(id) ON DELETE CASCADE,
  link_type    TEXT NOT NULL CHECK (link_type IN ('session', 'play')),
  link_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (objective_id, link_type, link_id)
);

-- The subject must be a team in the same academy, and a team has at most two
-- open objectives at once.
CREATE OR REPLACE FUNCTION development_objectives_guard()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = NEW.subject_id AND t.academy_id = NEW.academy_id
  ) THEN
    RAISE EXCEPTION 'Team not found in this academy' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'open' THEN
    SELECT count(*) INTO n
      FROM development_objectives o
     WHERE o.subject_type = NEW.subject_type
       AND o.subject_id   = NEW.subject_id
       AND o.status       = 'open'
       AND o.id <> NEW.id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'A team can work on two things at a time' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS development_objectives_guard_trg ON development_objectives;
CREATE TRIGGER development_objectives_guard_trg
  BEFORE INSERT OR UPDATE ON development_objectives
  FOR EACH ROW EXECUTE FUNCTION development_objectives_guard();

-- One place for "may the caller manage this team's objectives": the subject is
-- a team of the caller's academy that they coach, or they are an admin of it.
CREATE OR REPLACE FUNCTION can_manage_team_objective(
  p_academy_id UUID, p_subject_type TEXT, p_subject_id UUID
) RETURNS BOOLEAN LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_academy_id = auth_academy_id()
     AND p_subject_type = 'team'
     AND (is_team_coach(p_subject_id) OR auth_role() = 'admin');
$$;

ALTER TABLE development_objectives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_objective_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "development_objectives_coach_read"   ON development_objectives;
DROP POLICY IF EXISTS "development_objectives_coach_write"  ON development_objectives;
DROP POLICY IF EXISTS "development_objectives_coach_update" ON development_objectives;
DROP POLICY IF EXISTS "development_objectives_admin_delete" ON development_objectives;

CREATE POLICY "development_objectives_coach_read" ON development_objectives
  FOR SELECT TO authenticated
  USING (can_manage_team_objective(academy_id, subject_type, subject_id));

CREATE POLICY "development_objectives_coach_write" ON development_objectives
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND can_manage_team_objective(academy_id, subject_type, subject_id)
  );

CREATE POLICY "development_objectives_coach_update" ON development_objectives
  FOR UPDATE TO authenticated
  USING (can_manage_team_objective(academy_id, subject_type, subject_id))
  WITH CHECK (can_manage_team_objective(academy_id, subject_type, subject_id));

CREATE POLICY "development_objectives_admin_delete" ON development_objectives
  FOR DELETE TO authenticated
  USING (academy_id = auth_academy_id() AND auth_role() = 'admin');

DROP POLICY IF EXISTS "development_objective_links_coach_all" ON development_objective_links;

CREATE POLICY "development_objective_links_coach_all" ON development_objective_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM development_objectives o
       WHERE o.id = development_objective_links.objective_id
         AND can_manage_team_objective(o.academy_id, o.subject_type, o.subject_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM development_objectives o
       WHERE o.id = development_objective_links.objective_id
         AND can_manage_team_objective(o.academy_id, o.subject_type, o.subject_id)
    )
  );

COMMIT;

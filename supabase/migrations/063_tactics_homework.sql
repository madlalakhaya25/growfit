-- 063_tactics_homework.sql
--
-- Tactics homework: a coach sends players a saved play from the tactics board
-- with a short quiz (1 to 3 multiple-choice questions), and players do it at
-- home. Two new tables; nothing existing changes.
--
--   homework_assignments  one per send: team, the play, title, questions, due date
--   homework_responses    one per player per assignment: answers, score
--
-- Who can do what:
--   * coaches of the team (team_coaches, is_team_coach) and admins of the
--     academy manage assignments and read every response for them;
--   * a player reads assignments for teams they are an active member of, and
--     reads and writes only their own response (insert once, no edits);
--   * a linked parent reads their child's teams' assignments and their child's
--     responses, never writes.
--
-- The score is never trusted from the client: a trigger recomputes score and
-- total from the assignment's questions on insert, so a player writing straight
-- to the API cannot give themselves 3 out of 3.
--
-- Data kept to the minimum (POPIA): a response is the chosen option indexes and
-- a score, nothing free-text from the child. Erasing a player erases their
-- responses (ON DELETE CASCADE). Deleting the play keeps the homework and its
-- results (play_id becomes NULL; the title still says what it was).
--
-- Note: the questions column (answer key included) is readable by the team's
-- players, since RLS is row-level. The app only ever sends a player the
-- questions without the key until they have answered. Homework is practice, not
-- an exam, so that is an accepted trade-off rather than a separate key table.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.

BEGIN;

-- The questions shape: an array of 1 to 3 objects, each
--   { prompt: text 1..200, options: array of 2..4 non-empty texts (<= 100),
--     correct: integer index into options, explanation?: text <= 300 }
CREATE OR REPLACE FUNCTION homework_questions_valid(q JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  item JSONB;
  opt  JSONB;
  n    INT;
BEGIN
  IF q IS NULL OR jsonb_typeof(q) <> 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(q) NOT BETWEEN 1 AND 3 THEN RETURN FALSE; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(q) LOOP
    IF jsonb_typeof(item) <> 'object' THEN RETURN FALSE; END IF;
    IF jsonb_typeof(item->'prompt') IS DISTINCT FROM 'string'
       OR char_length(item->>'prompt') NOT BETWEEN 1 AND 200 THEN RETURN FALSE; END IF;
    IF jsonb_typeof(item->'options') IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
    n := jsonb_array_length(item->'options');
    IF n NOT BETWEEN 2 AND 4 THEN RETURN FALSE; END IF;
    FOR opt IN SELECT value FROM jsonb_array_elements(item->'options') LOOP
      IF jsonb_typeof(opt) <> 'string' OR char_length(opt #>> '{}') NOT BETWEEN 1 AND 100 THEN
        RETURN FALSE;
      END IF;
    END LOOP;
    IF jsonb_typeof(item->'correct') IS DISTINCT FROM 'number' THEN RETURN FALSE; END IF;
    IF (item->>'correct') !~ '^\d+$' OR (item->>'correct')::INT >= n THEN RETURN FALSE; END IF;
    IF item ? 'explanation' AND (
         jsonb_typeof(item->'explanation') <> 'string'
         OR char_length(item->>'explanation') > 300
       ) THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

CREATE TABLE IF NOT EXISTS homework_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id  UUID        NOT NULL REFERENCES academies(id)    ON DELETE CASCADE,
  team_id     UUID        NOT NULL REFERENCES teams(id)        ON DELETE CASCADE,
  play_id     UUID                 REFERENCES tactic_plays(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  questions   JSONB       NOT NULL CHECK (homework_questions_valid(questions)),
  due_date    DATE        NOT NULL,
  created_by  UUID        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS homework_assignments_team_idx
  ON homework_assignments (team_id, due_date DESC);

CREATE TABLE IF NOT EXISTS homework_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  player_id     UUID        NOT NULL REFERENCES players(id)              ON DELETE CASCADE,
  answers       JSONB       NOT NULL CHECK (jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) BETWEEN 1 AND 3),
  score         INT         NOT NULL DEFAULT 0 CHECK (score >= 0),
  total         INT         NOT NULL DEFAULT 0 CHECK (total >= 0),
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, player_id)
);

CREATE INDEX IF NOT EXISTS homework_responses_player_idx
  ON homework_responses (player_id, completed_at DESC);

-- Score from the assignment's own answer key, never from the client.
CREATE OR REPLACE FUNCTION homework_score_response()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  q JSONB;
  s INT := 0;
  i INT;
BEGIN
  SELECT questions INTO q FROM homework_assignments WHERE id = NEW.assignment_id;
  IF q IS NULL THEN RAISE EXCEPTION 'Homework not found'; END IF;
  IF jsonb_array_length(NEW.answers) <> jsonb_array_length(q) THEN
    RAISE EXCEPTION 'Answer every question' USING ERRCODE = '23514';
  END IF;
  FOR i IN 0 .. jsonb_array_length(q) - 1 LOOP
    IF (NEW.answers->i) = (q->i->'correct') THEN s := s + 1; END IF;
  END LOOP;
  NEW.score        := s;
  NEW.total        := jsonb_array_length(q);
  NEW.completed_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homework_responses_score ON homework_responses;
CREATE TRIGGER homework_responses_score
  BEFORE INSERT OR UPDATE ON homework_responses
  FOR EACH ROW EXECUTE FUNCTION homework_score_response();

ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_responses   ENABLE ROW LEVEL SECURITY;

-- Assignments -------------------------------------------------------------

DROP POLICY IF EXISTS "homework_assignments_staff_all"   ON homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_player_read" ON homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_parent_read" ON homework_assignments;

CREATE POLICY "homework_assignments_staff_all" ON homework_assignments
  FOR ALL TO authenticated
  USING (
    academy_id = auth_academy_id()
    AND (is_team_coach(team_id) OR auth_role() = 'admin')
  )
  WITH CHECK (
    academy_id = auth_academy_id()
    AND (is_team_coach(team_id) OR auth_role() = 'admin')
  );

CREATE POLICY "homework_assignments_player_read" ON homework_assignments
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
        JOIN players pl ON pl.id = tm.player_id
       WHERE tm.active AND pl.profile_id = auth.uid()
    )
  );

CREATE POLICY "homework_assignments_parent_read" ON homework_assignments
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
        JOIN parent_player_links ppl ON ppl.player_id = tm.player_id
       WHERE tm.active AND ppl.parent_id = auth.uid()
    )
  );

-- Responses ---------------------------------------------------------------

DROP POLICY IF EXISTS "homework_responses_staff_read"    ON homework_responses;
DROP POLICY IF EXISTS "homework_responses_player_read"   ON homework_responses;
DROP POLICY IF EXISTS "homework_responses_player_insert" ON homework_responses;
DROP POLICY IF EXISTS "homework_responses_parent_read"   ON homework_responses;

-- Staff read only: a coach never writes a child's answers.
CREATE POLICY "homework_responses_staff_read" ON homework_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM homework_assignments a
       WHERE a.id = homework_responses.assignment_id
         AND a.academy_id = auth_academy_id()
         AND (is_team_coach(a.team_id) OR auth_role() = 'admin')
    )
  );

CREATE POLICY "homework_responses_player_read" ON homework_responses
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE profile_id = auth.uid()));

-- Once, for themself, on homework for a team they are an active member of.
CREATE POLICY "homework_responses_player_insert" ON homework_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE profile_id = auth.uid())
    AND assignment_id IN (
      SELECT a.id FROM homework_assignments a
        JOIN team_members tm ON tm.team_id = a.team_id AND tm.active
       WHERE tm.player_id = homework_responses.player_id
    )
  );

CREATE POLICY "homework_responses_parent_read" ON homework_responses
  FOR SELECT TO authenticated
  USING (player_id IN (SELECT player_id FROM parent_player_links WHERE parent_id = auth.uid()));

COMMIT;

-- To verify: pg_policies should list three policies on homework_assignments
-- (staff_all, player_read, parent_read) and four on homework_responses
-- (staff_read, player_read, player_insert, parent_read); relrowsecurity true on
-- both; and
--   SELECT homework_questions_valid('[{"prompt":"Where?","options":["A","B"],"correct":1}]');
-- returns true, while correct = 2 returns false.

-- 045_ai_artefacts.sql
--
-- Every AI output in this app currently lives in a useState and is thrown away
-- (BACKLOG.md 3.2 / IP-16). A coach who generated a development plan on Tuesday
-- cannot see it on Wednesday, and regenerating bills the academy's Gemini key
-- again for an answer nobody disagreed with.
--
-- Staff RLS follows 041_fixture_match_plans exactly
-- (is_admin_or_coach() AND academy_id = auth_academy_id(), per 038/040).
-- Two extra SELECT-only policies let a player see their own and a parent their
-- linked child's, but ONLY kind='development_plan_shared' and ONLY once a coach
-- approved it. See the kind-split note in docs/AI_AND_UX_PLAN_2026.md.
--
-- subject_id is deliberately polymorphic with NO foreign key, which means
-- deleting a player does NOT cascade here. player-erasure.ts deletes these rows
-- explicitly — POPIA erasure is not optional and a cascade that doesn't exist
-- cannot be relied on.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_artefacts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id         UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,

  kind               TEXT        NOT NULL CHECK (kind IN (
                                   'development_plan',
                                   'development_plan_shared',
                                   'player_insights',
                                   'academy_health',
                                   'match_plan',
                                   'session_plan',
                                   'parent_report',
                                   'match_report')),
  subject_type       TEXT        NOT NULL CHECK (subject_type IN ('player','fixture','team','academy')),
  subject_id         UUID        NOT NULL,

  data               JSONB       NOT NULL,
  prose              TEXT,

  model_id           TEXT        NOT NULL,
  -- sha256 of the exact brief text sent to the model. The cache-hit rule is one
  -- equality check against this, instead of re-querying four input tables to
  -- ask "has anything changed since".
  inputs_fingerprint TEXT        NOT NULL,

  prompt_tokens      INTEGER,
  output_tokens      INTEGER,
  thinking_tokens    INTEGER,
  total_tokens       INTEGER,

  status             TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','approved')),
  approved_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- Denormalised: profiles RLS (001_schema.sql:225-228) lets a player or parent
  -- read only their OWN profile row, so a join to resolve this name returns
  -- null on exactly the surfaces that need it — and silently.
  approved_by_name   TEXT,
  approved_at        TIMESTAMPTZ,

  feedback           TEXT        CHECK (feedback IN ('helpful','not_helpful')),
  feedback_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  feedback_at        TIMESTAMPTZ,

  -- Set when a newer artefact replaces this one. History is kept rather than
  -- upserted away (unlike fixture_match_plans' one-row-per-fixture), because
  -- "did the last plan work" is exactly what gets fed back to the model.
  superseded_at      TIMESTAMPTZ,

  created_by         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_artefacts_subject_idx
  ON ai_artefacts (subject_type, subject_id, kind, created_at DESC);

-- The cache-hit lookup and the "current plan" lookup are both this shape.
CREATE INDEX IF NOT EXISTS ai_artefacts_live_idx
  ON ai_artefacts (kind, subject_id, inputs_fingerprint)
  WHERE superseded_at IS NULL;

-- The admin usage card: tokens and feedback per academy per month.
CREATE INDEX IF NOT EXISTS ai_artefacts_academy_idx
  ON ai_artefacts (academy_id, created_at DESC);

ALTER TABLE ai_artefacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_artefacts_staff_all" ON ai_artefacts;
CREATE POLICY "ai_artefacts_staff_all" ON ai_artefacts
  FOR ALL TO authenticated
  USING      (is_admin_or_coach() AND academy_id = auth_academy_id())
  WITH CHECK (is_admin_or_coach() AND academy_id = auth_academy_id());

DROP POLICY IF EXISTS "ai_artefacts_player_read" ON ai_artefacts;
CREATE POLICY "ai_artefacts_player_read" ON ai_artefacts
  FOR SELECT TO authenticated
  USING (
    kind = 'development_plan_shared'
    AND subject_type = 'player'
    AND status = 'approved'
    AND superseded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM players p
       WHERE p.id = ai_artefacts.subject_id AND p.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_artefacts_parent_read" ON ai_artefacts;
CREATE POLICY "ai_artefacts_parent_read" ON ai_artefacts
  FOR SELECT TO authenticated
  USING (
    kind = 'development_plan_shared'
    AND subject_type = 'player'
    AND status = 'approved'
    AND superseded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM parent_player_links ppl
       WHERE ppl.player_id = ai_artefacts.subject_id AND ppl.parent_id = auth.uid()
    )
  );

COMMENT ON COLUMN ai_artefacts.inputs_fingerprint IS
  'sha256 of the brief sent to the model. Cache hit requires this plus '
  'model_id to match and superseded_at IS NULL -- see lib/ai-artefacts.ts.';

COMMIT;

-- Safe to re-run: CREATE ... IF NOT EXISTS, every policy dropped by name first.
-- Verify with:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'ai_artefacts';
--   -- expect 3: staff_all (ALL), player_read (SELECT), parent_read (SELECT)
-- Then as a player (SET LOCAL ROLE authenticated, request.jwt.claim.sub = that
-- player's profile id): SELECT kind, data FROM ai_artefacts;
--   -- expect ONLY their own development_plan_shared rows, never a
--   -- 'development_plan' row, and never another child's.

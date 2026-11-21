-- ═══════════════════════════════════════════════════════════════════
-- Demo top-up for the TEST project (marketing videos)
-- ═══════════════════════════════════════════════════════════════════
--
-- Run AFTER supabase/seed.sql, on the same throwaway project. seed.sql is built
-- to exercise edge cases (two sessions, zero progress, four of six documents),
-- which reads as "empty" on camera: a training week with nothing in it, 0%
-- compliance, "Not enough data" on trend charts. This file adds the history a
-- healthy U13 squad would have, so the screens look like a working academy.
--
-- Everything is fictional. NEVER run against a real project.
--
-- Safe to re-run: fixed ids + ON CONFLICT. Dates are relative to now(), so
-- re-running before a recording session moves the "upcoming" training and
-- the recent history back to being relative to today.
--
-- What it sets up (all for U13 Eagles):
--   * 8 more past sessions (10 in total) and 2 upcoming ones, with attendance
--     and effort (RPE). Sanele and Thulani stay below the 75% threshold, so the
--     welfare check-in feature still has something real to show.
--   * 3 more completed fixtures with results, appearances and ratings, so
--     the rating trend has several months and the record is 2W 1D 1L.
--   * All six documents for 7 of 10 players (Sanele and Thulani each have one
--     outstanding; Asanda keeps seed.sql's two, which the parent app surfaces).
--   * More development milestones completed, across all five categories.
--   * Three more announcements.

BEGIN;

-- ── Sessions: 8 past + 2 upcoming ────────────────────────────────────
INSERT INTO training_sessions (id, team_id, coach_id, title, session_date, location, session_type)
SELECT
  ('10000000-0000-0000-0000-00000000050' || s.n)::uuid,
  '10000000-0000-0000-0000-0000000000b1',
  '10000000-0000-0000-0000-000000000002',
  trim(to_char(now() + make_interval(days => s.d), 'FMDay')) || ' session',
  now() + make_interval(days => s.d),
  'Riverside Grounds',
  s.t
FROM (VALUES
  (1, -1,  'tactical'),
  (2, -3,  'technical'),
  (3, -14, 'fitness'),
  (4, -17, 'technical'),
  (5, -21, 'tactical'),
  (6, -24, 'technical'),
  (7, -28, 'match_prep'),
  (8, -31, 'technical'),
  (9,  4,  'match_prep'),
  (0,  6,  'technical')
) AS s(n, d, t)
ON CONFLICT (id) DO UPDATE SET session_date = EXCLUDED.session_date, title = EXCLUDED.title;

-- Attendance + effort for the 8 past sessions.
-- Sanele (c5) and Thulani (c9) attend every other session: 4 of 10 including
-- the two seed.sql sessions, which is 40% and flagged. Everyone else is
-- present, with the odd late or absence picked by a stable hash.
INSERT INTO training_attendance (session_id, player_id, status, marked_by, rpe)
SELECT
  ts.id, p.id,
  CASE
    WHEN p.id IN ('10000000-0000-0000-0000-0000000000c5', '10000000-0000-0000-0000-0000000000c9')
      THEN CASE WHEN (right(ts.id::text, 1))::int % 2 = 0 THEN 'present' ELSE 'absent' END
    -- Zanele's hash lands on four absences; keep her above the threshold.
    WHEN p.id = '10000000-0000-0000-0000-0000000000c7' THEN 'present'
    WHEN abs(hashtext(ts.id::text || p.id::text)) % 14 = 0 THEN 'absent'
    WHEN abs(hashtext(ts.id::text || p.id::text)) % 14 = 1 THEN 'late'
    ELSE 'present'
  END,
  '10000000-0000-0000-0000-000000000002',
  5 + abs(hashtext(p.id::text || ts.id::text)) % 4
FROM training_sessions ts
CROSS JOIN players p
WHERE ts.id::text LIKE '10000000-0000-0000-0000-00000000050%'
  AND ts.session_date < now()
  AND p.academy_id = '10000000-0000-0000-0000-0000000000a1'
ON CONFLICT (session_id, player_id) DO UPDATE SET status = EXCLUDED.status, rpe = EXCLUDED.rpe;

-- Effort only makes sense for someone who trained.
UPDATE training_attendance SET rpe = NULL WHERE status = 'absent' AND rpe IS NOT NULL;

-- ── Fixtures: 3 more completed results ───────────────────────────────
INSERT INTO fixtures (id, team_id, opponent, venue, fixture_date, is_home, status, created_by) VALUES
  ('10000000-0000-0000-0000-0000000000f4', '10000000-0000-0000-0000-0000000000b1', 'Umlazi Stars FC',        'Riverside Grounds',   now() - interval '28 days', true,  'completed', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f5', '10000000-0000-0000-0000-0000000000b1', 'Westville Wanderers',    'Westville Fields',    now() - interval '42 days', false, 'completed', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f6', '10000000-0000-0000-0000-0000000000b1', 'Isipingo Eagles',        'Riverside Grounds',   now() - interval '63 days', true,  'completed', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET fixture_date = EXCLUDED.fixture_date, status = EXCLUDED.status;

INSERT INTO match_results (fixture_id, team_score, opponent_score, match_notes, logged_by) VALUES
  ('10000000-0000-0000-0000-0000000000f4', 2, 0, 'Clean sheet. Pressed well from the front.', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f5', 1, 1, 'Equaliser in the last five minutes after a slow start.', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f6', 1, 2, 'Lost the second half. Fitness work added to the week.', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (fixture_id) DO UPDATE SET team_score = EXCLUDED.team_score, opponent_score = EXCLUDED.opponent_score;

INSERT INTO match_appearances (fixture_id, player_id, played, minutes_played)
SELECT f.id, p.id, true, CASE WHEN p.id = '10000000-0000-0000-0000-0000000000ca' THEN 35 ELSE 60 END
FROM (VALUES
  ('10000000-0000-0000-0000-0000000000f4'::uuid),
  ('10000000-0000-0000-0000-0000000000f5'::uuid),
  ('10000000-0000-0000-0000-0000000000f6'::uuid)
) AS f(id)
CROSS JOIN players p
WHERE p.academy_id = '10000000-0000-0000-0000-0000000000a1'
ON CONFLICT (fixture_id, player_id) DO NOTHING;

INSERT INTO player_ratings (fixture_id, player_id, coach_id, rating)
SELECT f.id, p.id, '10000000-0000-0000-0000-000000000002',
       3 + abs(hashtext(f.id::text || p.id::text)) % 3
FROM (VALUES
  ('10000000-0000-0000-0000-0000000000f4'::uuid),
  ('10000000-0000-0000-0000-0000000000f5'::uuid),
  ('10000000-0000-0000-0000-0000000000f6'::uuid)
) AS f(id)
CROSS JOIN players p
WHERE p.academy_id = '10000000-0000-0000-0000-0000000000a1'
ON CONFLICT (fixture_id, player_id, coach_id) WHERE fixture_id IS NOT NULL DO UPDATE SET rating = EXCLUDED.rating;

-- Ratings are logged just after the match, so date them that way. Left at the
-- insert time they all fall in one month and the rating trend reads
-- "Not enough data". Also corrects seed.sql's own rating rows.
UPDATE player_ratings pr SET created_at = f.fixture_date + interval '2 hours'
FROM fixtures f
WHERE f.id = pr.fixture_id
  AND f.team_id = '10000000-0000-0000-0000-0000000000b1'
  AND pr.created_at > f.fixture_date + interval '1 day';

-- ── Documents: all six for most of the squad ──────────────────────────
-- Asanda (c1) keeps seed.sql's two outstanding on purpose: the parent app's
-- "needs you" card is a feature worth showing. Sanele (c5) is missing his ID
-- document and Thulani (c9) his medical consent, so compliance reads
-- realistically (7 of 10 players fully complete), not a flat 100%.
INSERT INTO player_documents (player_id, document_type, season, signed_digitally, signer_name, signer_role, signed_at, status)
SELECT p.id, d.t, '2026', true,
       'Guardian ' || split_part(p.full_name, ' ', 2), 'parent',
       now() - make_interval(days => 40 + abs(hashtext(p.id::text || d.t)) % 20), 'signed'
FROM players p
CROSS JOIN (VALUES ('registration_agreement'), ('consent_form'), ('code_of_ethics'),
                   ('medical_consent'), ('popia_consent'), ('id_document')) AS d(t)
WHERE p.academy_id = '10000000-0000-0000-0000-0000000000a1'
  AND p.id <> '10000000-0000-0000-0000-0000000000c1'
  AND NOT (p.id = '10000000-0000-0000-0000-0000000000c5' AND d.t = 'id_document')
  AND NOT (p.id = '10000000-0000-0000-0000-0000000000c9' AND d.t = 'medical_consent')
ON CONFLICT (player_id, document_type, season) DO UPDATE SET status = EXCLUDED.status;

-- ── Development milestones across all five categories ─────────────────
-- Asanda ends 4 of 5 done (one to go), which is a better story than 1 of 5.
INSERT INTO player_milestone_completions (template_id, player_id, season, completed_by, note) VALUES
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000c1', '2026', '10000000-0000-0000-0000-000000000002', 'Distribution under pressure has improved a lot this term.'),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-0000000000c1', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-0000000000c1', '2026', '10000000-0000-0000-0000-000000000003', 'Lifts the back four after a goal against.'),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-0000000000c2', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-0000000000c2', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-0000000000c4', '2026', '10000000-0000-0000-0000-000000000003', NULL),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-0000000000c6', '2026', '10000000-0000-0000-0000-000000000002', 'Switches play early now.'),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-0000000000c6', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-0000000000c6', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000c8', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-0000000000c8', '2026', '10000000-0000-0000-0000-000000000002', NULL),
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000ca', '2026', '10000000-0000-0000-0000-000000000002', NULL)
ON CONFLICT (template_id, player_id, season) DO NOTHING;

-- ── Announcements ─────────────────────────────────────────────────────
INSERT INTO announcements (id, team_id, coach_id, title, body, created_at) VALUES
  ('10000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002',
   'Away match on Thursday: Chatsworth United',
   'Kick-off is 18:59 at Chatsworth Stadium. Players meet at Riverside Grounds at 17:30 for the transport. Please bring both kits.',
   now() - interval '3 hours'),
  ('10000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000003',
   'Well played against Umlazi Stars',
   'A clean sheet and a strong team performance. Thank you to every parent who stayed to cheer. Training resumes on Wednesday.',
   now() - interval '5 days'),
  ('10000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002',
   'Lift-share for away matches',
   'Transport has been a problem for a few families. If you have a spare seat on match days, please tell your coach so we can pair you up.',
   now() - interval '9 days')
ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, created_at = EXCLUDED.created_at;

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────
-- Expect: 12 sessions, 6 fixtures, below_75 = 2 (Sanele, Thulani), and
-- 7 players with all six documents.
SELECT
  (SELECT count(*) FROM training_sessions WHERE team_id = '10000000-0000-0000-0000-0000000000b1') AS sessions,
  (SELECT count(*) FROM fixtures WHERE team_id = '10000000-0000-0000-0000-0000000000b1') AS fixtures,
  (SELECT count(*) FROM (
     SELECT player_id,
            count(*) FILTER (WHERE status IN ('present','late'))::float
              / NULLIF(count(*) FILTER (WHERE status <> 'excused'), 0) AS pct
     FROM training_attendance ta JOIN training_sessions ts ON ts.id = ta.session_id
     WHERE ts.session_date < now() AND ts.session_date > now() - interval '90 days'
     GROUP BY player_id) a WHERE pct < 0.75) AS below_75,
  (SELECT count(*) FROM (
     SELECT player_id FROM player_documents WHERE status = 'signed' AND season = '2026'
     GROUP BY player_id HAVING count(*) = 6) d) AS players_all_six_docs;

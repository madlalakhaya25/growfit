-- ═══════════════════════════════════════════════════════════════════
-- Reset the TEST project's demo data to a clean starting point
-- ═══════════════════════════════════════════════════════════════════
--
-- Run before each recording take (after seed.sql and seed_demo.sql). The demo videos tick
-- boxes, mark the register, apply AI plans and post announcements, and the AI results are
-- cached, so a second take would show a different, half-finished screen. This puts back what
-- the first take found. Scoped to the fixed demo ids; nothing else is touched.
--
-- NEVER run against a real project.

BEGIN;

-- The two upcoming sessions the videos work on (Wednesday and Friday of next week).
DELETE FROM training_attendance WHERE session_id IN
  ('10000000-0000-0000-0000-000000000509', '10000000-0000-0000-0000-000000000500');
DELETE FROM training_drills WHERE session_id IN
  ('10000000-0000-0000-0000-000000000509', '10000000-0000-0000-0000-000000000500');
DELETE FROM curriculum_links WHERE link_type = 'session' AND link_id IN
  ('10000000-0000-0000-0000-000000000509', '10000000-0000-0000-0000-000000000500');

-- AI answers are cached per input. Mark them superseded (the app then ignores them) so every take shows
-- the generating state. An UPDATE, not a DELETE, so it needs no extra confirmation.
UPDATE ai_artefacts SET superseded_at = now()
  WHERE academy_id = '10000000-0000-0000-0000-0000000000a1' AND superseded_at IS NULL;

-- Things the videos post or save.
DELETE FROM announcements
  WHERE team_id = '10000000-0000-0000-0000-0000000000b1' AND title = 'Match day: Chatsworth United';
DELETE FROM tactic_plays WHERE name LIKE 'AI suggestion%';

COMMIT;

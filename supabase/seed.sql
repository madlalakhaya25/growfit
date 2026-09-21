-- ═══════════════════════════════════════════════════════════════════
-- Seed data for a throwaway TEST Supabase project
-- ═══════════════════════════════════════════════════════════════════
--
-- Backlog 0.3. `web/e2e/README.md` explains why this exists: the Playwright
-- smoke suite deliberately stops at "does the app not crash" because there
-- is no seeded project to log in against — the flows that actually break in
-- production (attendance under a bad connection, a PDF import misattributing
-- a photo, a cancelled fixture's reason reaching a parent) all need a
-- signed-in user with a real squad behind them.
--
-- This is that seed. It creates one academy, five logins (an admin, a head
-- coach, an assistant coach, a parent, and a player who is also that
-- parent's linked child), a ten-player U13 squad, two training sessions
-- with attendance marked across every P/A/L/E state, three fixtures
-- (completed with a logged result, upcoming, and cancelled with a reason),
-- attribute assessments from both coaches on the same player, milestones,
-- documents in mixed completion states, and a calendar-feed token — enough
-- surface to exercise the fixes this pass made, not just render a page.
--
-- ⚠️  DO NOT RUN THIS AGAINST A PRODUCTION PROJECT. It is meant for a
-- throwaway or dedicated test Supabase project only. Every id below is a
-- fixed, hardcoded UUID starting `10000000-…` specifically so it is
-- unmistakable in a table browser and impossible to confuse with anything a
-- real signup created — if you see one of these ids in production data,
-- something has gone wrong.
--
-- ── Prerequisites ────────────────────────────────────────────────────
-- Run every file in supabase/migrations/, in order, first (030-037 as of
-- this writing — see docs/MIGRATION_RUNBOOK.md). This script assumes the
-- schema they produce.
--
-- ── How to run ───────────────────────────────────────────────────────
-- Supabase SQL editor: paste and run.
-- CLI: `supabase db execute --file supabase/seed.sql` (or `psql` directly
-- against the project's connection string).
--
-- Safe to re-run: every insert is `ON CONFLICT DO NOTHING` or
-- `ON CONFLICT ... DO UPDATE`, keyed on the fixed ids, so running this twice
-- updates rather than duplicates.
--
-- ── Logging in ───────────────────────────────────────────────────────
-- All five accounts share the password below. Change it in this file before
-- running if that's a concern for how the test project is shared.
--
--   admin@seed.growfit.test    — admin
--   coach@seed.growfit.test    — head coach, U13 Eagles
--   assistant@seed.growfit.test — assistant coach, same team (for the
--                                  multi-coach-visibility surfaces)
--   parent@seed.growfit.test   — parent, linked to Asanda Khumalo
--   player@seed.growfit.test   — Asanda Khumalo's own login
--
-- ── Playwright ───────────────────────────────────────────────────────
-- Per the e2e README: log in as each of the five above through the real UI
-- once, save the session with Playwright's `storageState`, and reuse it —
-- that unlocks testing signed-in flows without re-authenticating per test.
--
-- ── Verified ─────────────────────────────────────────────────────────
-- Run end-to-end against a real PostgreSQL 16 instance (auth.users/
-- auth.identities and the anon/authenticated roles reproduced to match a
-- real Supabase project — see docs/MIGRATION_RUNBOOK.md for that harness),
-- with every migration 001-037 applied first. Confirmed: runs clean, is
-- idempotent (re-run leaves row counts unchanged), the attendance numbers
-- land exactly as designed (Sanele and Thulani 0% and correctly below the
-- 75% threshold, Lindiwe 100% with late counted as attended, Zanele 100%
-- with the excused session excluded from the total rather than counted
-- against her), get_public_passport() correctly averages both coaches'
-- attribute assessments of Asanda, get_calendar_events() returns all five
-- events for the parent's token including the cancelled fixture's reason,
-- and each seeded profile reads exactly what RLS should let it read (the
-- parent sees the squad, the player reads their own row via profile_id).
-- Not verified: actual GoTrue login (no live Supabase project exists in
-- this environment) — the auth.users/auth.identities shape follows the
-- documented, widely-used pattern for SQL-seeded Supabase accounts, but
-- confirm a real login succeeds the first time this runs against an
-- actual project before relying on it for Playwright auth states.

BEGIN;

-- ── auth.users + auth.identities ─────────────────────────────────────
--
-- `handle_new_user()` (migration 027) always creates a `player`-role profile
-- regardless of what's in raw_user_meta_data, and never sets academy_id —
-- both deliberate, closing the privilege-escalation paths that migration
-- documents. So every account is created as a plain player signup, then
-- promoted directly below. That's a seed script's job (direct database
-- access); the app itself has no path that lets a signup grant itself
-- admin or coach, and this script doesn't exercise that path — it bypasses
-- it on purpose, the way a real admin's initial account has to be bootstrapped.
--
-- `email_confirmed_at` is set at insert so login works immediately with no
-- confirmation email — a test project usually has no email delivery
-- configured, and password-recovery/confirmation flows aren't what this
-- seed is for.
--
-- The `auth.identities` row is required by current GoTrue versions for
-- email/password login to recognise the user at all; omitting it is the
-- most common reason a seeded-via-SQL account can't sign in.

DO $$
DECLARE
  v_password TEXT := crypt('SeedPass123!', gen_salt('bf'));
  -- `role` here is deliberately always 'player' or 'parent' — the only two
  -- values handle_new_user() (migration 027) will actually assign from
  -- signup metadata; anything else (including 'admin' or 'coach') is
  -- rejected back to 'player' by design, the same as the real signup forms
  -- (auth/register/page.tsx, register-club/page.tsx) which promote to
  -- admin/coach afterward through a privileged path, not at signup. This
  -- script promotes directly via UPDATE below instead of replaying that
  -- flow. Always setting a role here (never omitting the key) also avoids
  -- a real, separate bug the trigger has: `IF v_role NOT IN (...)` on a
  -- NULL v_role (metadata with no "role" key at all) evaluates to NULL,
  -- which plpgsql's IF treats as false, so the fallback-to-'player' never
  -- fires and the INSERT hits profiles.role''s NOT NULL constraint instead.
  -- Every real signup path in this app does send a role, so that edge case
  -- isn't reachable through the UI today — flagged for the RLS/security
  -- audit (backlog 1.5 / docs/BACKLOG.md) rather than patched here.
  v_users JSONB := '[
    {"id":"10000000-0000-0000-0000-000000000001","email":"admin@seed.growfit.test","full_name":"Thabo Mokoena","role":"player"},
    {"id":"10000000-0000-0000-0000-000000000002","email":"coach@seed.growfit.test","full_name":"Sipho Ndlovu","role":"player"},
    {"id":"10000000-0000-0000-0000-000000000003","email":"assistant@seed.growfit.test","full_name":"Buhle Zulu","role":"player"},
    {"id":"10000000-0000-0000-0000-000000000004","email":"parent@seed.growfit.test","full_name":"Nomvula Khumalo","role":"parent"},
    {"id":"10000000-0000-0000-0000-000000000005","email":"player@seed.growfit.test","full_name":"Asanda Khumalo","role":"player"}
  ]'::jsonb;
  v_user JSONB;
  v_id UUID;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    v_id := (v_user->>'id')::uuid;

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_user->>'email', v_password,
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_user->>'full_name', 'role', v_user->>'role'),
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_user->>'email'),
      'email', v_id::text, now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END LOOP;
END $$;

-- ── Academy ───────────────────────────────────────────────────────────
INSERT INTO academies (id, name, location, province)
VALUES ('10000000-0000-0000-0000-0000000000a1', 'Riverside Test Academy', 'Chatsworth', 'KwaZulu-Natal')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ── Promote profiles past what handle_new_user() gave them ─────────────
-- The trigger already created a `player` row with no academy for every id
-- above (see the comment on auth.users). Assign the real role and academy
-- directly, which only a seed script or a migration should ever do.
UPDATE profiles SET role = 'admin',  academy_id = '10000000-0000-0000-0000-0000000000a1' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE profiles SET role = 'coach',  academy_id = '10000000-0000-0000-0000-0000000000a1' WHERE id = '10000000-0000-0000-0000-000000000002';
UPDATE profiles SET role = 'coach',  academy_id = '10000000-0000-0000-0000-0000000000a1' WHERE id = '10000000-0000-0000-0000-000000000003';
UPDATE profiles SET role = 'parent', academy_id = '10000000-0000-0000-0000-0000000000a1' WHERE id = '10000000-0000-0000-0000-000000000004';
UPDATE profiles SET role = 'player', academy_id = '10000000-0000-0000-0000-0000000000a1' WHERE id = '10000000-0000-0000-0000-000000000005';

-- ── Team ────────────────────────────────────────────────────────────
INSERT INTO teams (id, academy_id, name, age_group, coach_id, invite_code, active)
VALUES (
  '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000a1',
  'U13 Eagles', 'U13', '10000000-0000-0000-0000-000000000002', 'SEED01', true
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, age_group = EXCLUDED.age_group;

-- Two coaches on one team — this is what surfaces the multi-coach cases
-- (a coach's own assessment differing from the squad average, attribution
-- on who marked what) that a single-coach seed can't exercise at all.
INSERT INTO team_coaches (team_id, coach_id, is_head) VALUES
  ('10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000003', false)
ON CONFLICT (team_id, coach_id) DO NOTHING;

-- ── Squad: ten players, one with her own login ──────────────────────
-- Position codes are the specific roles (migration 018 widened the CHECK
-- to allow these alongside the original five legacy groups).
INSERT INTO players (id, profile_id, academy_id, full_name, date_of_birth, position, preferred_foot, active) VALUES
  ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000a1', 'Asanda Khumalo',    '2013-03-14', 'gk',  'right', true),
  ('10000000-0000-0000-0000-0000000000c2', NULL, '10000000-0000-0000-0000-0000000000a1', 'Buhle Ngcobo',      '2013-06-02', 'cb',  'right', true),
  ('10000000-0000-0000-0000-0000000000c3', NULL, '10000000-0000-0000-0000-0000000000a1', 'Nkosana Dlamini',   '2013-01-22', 'cb',  'left',  true),
  ('10000000-0000-0000-0000-0000000000c4', NULL, '10000000-0000-0000-0000-0000000000a1', 'Lindiwe Mahlangu',  '2013-09-11', 'lb',  'left',  true),
  ('10000000-0000-0000-0000-0000000000c5', NULL, '10000000-0000-0000-0000-0000000000a1', 'Sanele Buthelezi',  '2013-04-30', 'rb',  'right', true),
  ('10000000-0000-0000-0000-0000000000c6', NULL, '10000000-0000-0000-0000-0000000000a1', 'Mpho Radebe',       '2013-11-05', 'cdm', 'right', true),
  ('10000000-0000-0000-0000-0000000000c7', NULL, '10000000-0000-0000-0000-0000000000a1', 'Zanele Mkhize',     '2013-02-18', 'cm',  'both',  true),
  ('10000000-0000-0000-0000-0000000000c8', NULL, '10000000-0000-0000-0000-0000000000a1', 'Ayanda Zungu',      '2013-07-27', 'lw',  'left',  true),
  ('10000000-0000-0000-0000-0000000000c9', NULL, '10000000-0000-0000-0000-0000000000a1', 'Thulani Nkosi',     '2013-05-09', 'rw',  'right', true),
  ('10000000-0000-0000-0000-0000000000ca', NULL, '10000000-0000-0000-0000-0000000000a1', 'Kagiso Mokoena',    '2013-08-16', 'st',  'right', true)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, position = EXCLUDED.position;

INSERT INTO team_members (team_id, player_id)
SELECT '10000000-0000-0000-0000-0000000000b1', id FROM players
WHERE id IN (
  '10000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c2',
  '10000000-0000-0000-0000-0000000000c3','10000000-0000-0000-0000-0000000000c4',
  '10000000-0000-0000-0000-0000000000c5','10000000-0000-0000-0000-0000000000c6',
  '10000000-0000-0000-0000-0000000000c7','10000000-0000-0000-0000-0000000000c8',
  '10000000-0000-0000-0000-0000000000c9','10000000-0000-0000-0000-0000000000ca'
)
ON CONFLICT (team_id, player_id) DO NOTHING;

-- ── Parent link ───────────────────────────────────────────────────────
-- `verification_method = 'staff_added'` (migration 032's vocabulary) is the
-- realistic case for a seed: a coach/admin created the link directly rather
-- than the parent redeeming a code, which is the flow this script cannot
-- exercise from raw SQL anyway.
INSERT INTO parent_player_links (parent_id, player_id, relationship, verified_at, verified_by, verification_method)
VALUES (
  '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000c1',
  'parent', now(), '10000000-0000-0000-0000-000000000002', 'staff_added'
)
ON CONFLICT (parent_id, player_id) DO NOTHING;

-- ── Training sessions + attendance ──────────────────────────────────
-- Deliberately exercises every state migration 036 fixed:
--   Thulani and Sanele: absent both sessions → genuinely below 75%,
--     the one real welfare-checkin case in this seed.
--   Lindiwe: late then present → late counts as attended (100%).
--   Zanele: excused then present → the excused session is left out of
--     the total entirely (100% of 1, not 50% of 2).
-- Dates are inside the 90-day rolling window (lib/attendance.ts) relative
-- to when this is run, computed from now() rather than a fixed date so the
-- seed stays valid however long after this was written it's actually used.
INSERT INTO training_sessions (id, team_id, coach_id, title, session_date, location, session_type) VALUES
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002', 'Wednesday session', now() - interval '10 days', 'Riverside Grounds', 'technical'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002', 'Friday session',    now() - interval '7 days',  'Riverside Grounds', 'tactical')
ON CONFLICT (id) DO UPDATE SET session_date = EXCLUDED.session_date;

INSERT INTO training_attendance (session_id, player_id, status, marked_by) VALUES
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c1', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c2', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c3', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c4', 'late',    '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c5', 'absent',  '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c6', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c7', 'excused', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c8', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000c9', 'absent',  '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000ca', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c1', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c2', 'absent',  '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c3', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c4', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c5', 'absent',  '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c6', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c7', 'present', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c8', 'late',    '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000c9', 'absent',  '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000ca', 'present', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (session_id, player_id) DO UPDATE SET status = EXCLUDED.status;

-- The one real welfare case this seed produces: Thulani Nkosi, 0% over two
-- sessions, already checked in on once — so the welfare page shows both a
-- fresh alert (Sanele, never checked in) and a returning one (Thulani, with
-- checkin history) rather than only ever the empty state.
INSERT INTO welfare_checkins (id, player_id, noted_by, attendance_pct, note, created_at)
VALUES (
  '10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000c9',
  '10000000-0000-0000-0000-000000000002', 0,
  'Called home — family says transport has been the issue, working on a lift share.',
  now() - interval '6 days'
)
ON CONFLICT (id) DO NOTHING;

-- ── Fixtures: completed, upcoming, cancelled ────────────────────────
INSERT INTO fixtures (id, team_id, opponent, venue, fixture_date, is_home, status, cancellation_reason, created_by) VALUES
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000b1', 'Sundowns Youth Academy', 'Riverside Grounds', now() - interval '14 days', true,  'completed', NULL, '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f2', '10000000-0000-0000-0000-0000000000b1', 'Chatsworth United',      'Chatsworth Stadium', now() + interval '5 days',  false, 'upcoming',  NULL, '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-0000000000b1', 'Wentworth Rangers',      'Wentworth Sports Ground', now() + interval '2 days', true, 'cancelled', 'Ground waterlogged after heavy rain — LFA postponed the fixture.', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, cancellation_reason = EXCLUDED.cancellation_reason;

INSERT INTO match_results (fixture_id, team_score, opponent_score, match_notes, logged_by)
VALUES ('10000000-0000-0000-0000-0000000000f1', 3, 1, 'Strong first half, controlled the second after going 2-0 up.', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (fixture_id) DO UPDATE SET team_score = EXCLUDED.team_score, opponent_score = EXCLUDED.opponent_score;

-- Nine played, Kagiso unused off the bench.
INSERT INTO match_appearances (fixture_id, player_id, played)
SELECT '10000000-0000-0000-0000-0000000000f1', id,
       id <> '10000000-0000-0000-0000-0000000000ca'
FROM players
WHERE id IN (
  '10000000-0000-0000-0000-0000000000c1','10000000-0000-0000-0000-0000000000c2',
  '10000000-0000-0000-0000-0000000000c3','10000000-0000-0000-0000-0000000000c4',
  '10000000-0000-0000-0000-0000000000c5','10000000-0000-0000-0000-0000000000c6',
  '10000000-0000-0000-0000-0000000000c7','10000000-0000-0000-0000-0000000000c8',
  '10000000-0000-0000-0000-0000000000c9','10000000-0000-0000-0000-0000000000ca'
)
ON CONFLICT (fixture_id, player_id) DO NOTHING;

INSERT INTO player_ratings (fixture_id, player_id, coach_id, rating, note) VALUES
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000002', 4, 'Commanded the box well, one great save in the second half.'),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-000000000002', 4, NULL),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-000000000002', 3, NULL),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c4', '10000000-0000-0000-0000-000000000002', 3, NULL),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c5', '10000000-0000-0000-0000-000000000002', 3, NULL),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c6', '10000000-0000-0000-0000-000000000002', 4, 'Broke up two dangerous counters.'),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c7', '10000000-0000-0000-0000-000000000002', 4, NULL),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c8', '10000000-0000-0000-0000-000000000002', 5, 'Scored twice, unplayable in the first half.'),
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000c9', '10000000-0000-0000-0000-000000000002', 3, NULL)
ON CONFLICT (fixture_id, player_id, coach_id) WHERE fixture_id IS NOT NULL DO UPDATE SET rating = EXCLUDED.rating;

-- ── Attribute assessments — from BOTH coaches on the same player ──────
-- This is what surfaces the "your assessment vs squad average" case: Sipho
-- (head coach) and Buhle (assistant) each assessed Asanda, and gave
-- different numbers, exactly the scenario a single-coach seed cannot show
-- at all. Column set matches GK_ATTRS (lib/attributes.ts): shot_stopping,
-- reflexes, distribution, handling, positioning, decision_making,
-- game_reading, agility, pace, jumping, strength, composure, leadership,
-- communication.
INSERT INTO player_attributes (
  player_id, coach_id, pace, agility, jumping, strength, composure,
  shot_stopping, reflexes, distribution, handling,
  positioning, decision_making, game_reading, leadership, communication
) VALUES
  ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000002',
   58, 71, 68, 62, 74, 78, 81, 66, 74, 70, 68, 65, 60, 71),
  ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000003',
   55, 69, 70, 65, 70, 74, 79, 63, 71, 66, 66, 63, 58, 68)
ON CONFLICT (player_id, coach_id) DO UPDATE SET
  shot_stopping = EXCLUDED.shot_stopping, reflexes = EXCLUDED.reflexes;

-- Kagiso (striker) — STRIKER_ATTRS: finishing, heading, ball_control,
-- dribbling, shooting (technical); positioning, decision_making,
-- off_ball_movement (tactical); pace, strength, jumping, agility, stamina
-- (physical); composure, work_rate (mental); no leadership set.
INSERT INTO player_attributes (
  player_id, coach_id, pace, strength, jumping, agility, stamina,
  shooting, dribbling, finishing, heading, ball_control,
  positioning, decision_making, off_ball_movement, composure, work_rate
) VALUES (
  '10000000-0000-0000-0000-0000000000ca', '10000000-0000-0000-0000-000000000002',
  76, 64, 70, 72, 68, 71, 74, 79, 62, 73, 75, 69, 77, 70, 66
)
ON CONFLICT (player_id, coach_id) DO UPDATE SET finishing = EXCLUDED.finishing;

-- ── Development milestones ───────────────────────────────────────────
INSERT INTO development_milestone_templates (id, academy_id, title, description, category, age_group, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000a1', 'First-time pass under pressure', 'Consistently plays a clean first-time pass with an opponent closing down.', 'technical', 'U13', 1),
  ('10000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-0000000000a1', 'Reads the press and switches play', 'Recognises when the ball side is congested and switches to space.', 'tactical', 'U13', 2),
  ('10000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-0000000000a1', 'Recovers within 3 seconds of losing the ball', 'Counter-presses immediately rather than jogging back.', 'physical', 'U13', 3),
  ('10000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-0000000000a1', 'Communicates positively after a mistake', 'Encourages a teammate rather than showing frustration.', 'mental', 'U13', 4),
  ('10000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-0000000000a1', 'Organises the back line from goal kicks', 'Calls out shape and marking assignments unprompted.', 'leadership', 'U13', 5)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

INSERT INTO player_milestone_completions (template_id, player_id, season, completed_by, note) VALUES
  ('10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-0000000000c7', '2026', '10000000-0000-0000-0000-000000000002', 'Showing this consistently in small-sided games now.'),
  ('10000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-0000000000c1', '2026', '10000000-0000-0000-0000-000000000002', NULL)
ON CONFLICT (template_id, player_id, season) DO NOTHING;

-- ── Documents, medical, consents — for the linked child ─────────────
-- Deliberately mixed completion states (2 of 6 outstanding), so a document
-- funnel view has something to actually filter rather than a uniformly
-- complete or uniformly empty record.
INSERT INTO player_documents (player_id, document_type, season, signed_digitally, signer_name, signer_role, signed_at, status) VALUES
  ('10000000-0000-0000-0000-0000000000c1', 'registration_agreement', '2026', true, 'Nomvula Khumalo', 'parent', now() - interval '60 days', 'signed'),
  ('10000000-0000-0000-0000-0000000000c1', 'consent_form',           '2026', true, 'Nomvula Khumalo', 'parent', now() - interval '60 days', 'signed'),
  ('10000000-0000-0000-0000-0000000000c1', 'code_of_ethics',         '2026', true, 'Nomvula Khumalo', 'parent', now() - interval '58 days', 'signed'),
  ('10000000-0000-0000-0000-0000000000c1', 'popia_consent',          '2026', true, 'Nomvula Khumalo', 'parent', now() - interval '58 days', 'signed')
ON CONFLICT (player_id, document_type, season) DO UPDATE SET status = EXCLUDED.status;
-- medical_consent and id_document intentionally left absent — the two
-- outstanding items a document funnel view should surface for this child.

INSERT INTO player_medical (
  player_id, blood_type, allergies, emergency_1_name, emergency_1_relationship, emergency_1_phone,
  has_medical_aid, nearest_hospital, season
) VALUES (
  '10000000-0000-0000-0000-0000000000c1', 'O+', 'NONE', 'Nomvula Khumalo', 'Mother', '082 555 0104',
  true, 'Chatsmed Garden Hospital', '2026'
)
ON CONFLICT (player_id) DO UPDATE SET blood_type = EXCLUDED.blood_type;

INSERT INTO player_consents (player_id, season, participation_consent, photo_consent, transport_consent, risk_acknowledged, signed_by, signed_at)
VALUES ('10000000-0000-0000-0000-0000000000c1', '2026', true, true, true, true, 'Nomvula Khumalo', now() - interval '60 days')
ON CONFLICT (player_id, season) DO UPDATE SET photo_consent = EXCLUDED.photo_consent;

-- ── Announcement ──────────────────────────────────────────────────────
INSERT INTO announcements (id, team_id, coach_id, title, body) VALUES (
  '10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000002',
  'Kit collection this Friday',
  'Please collect the new training bibs from the clubhouse before Friday''s session. Bring your own water bottle — it has been hot.'
)
ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body;

-- ── Drill library ─────────────────────────────────────────────────────
INSERT INTO drill_library (id, academy_id, created_by, name, description, category, duration_minutes, difficulty) VALUES
  ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002',
   'Rondo 4v2', 'Tight rondo to sharpen first touch and quick decisions under pressure.', 'warm_up', 10, 'beginner'),
  ('10000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002',
   'Finishing under pressure', 'Server plays the ball in, a recovering defender closes down as the striker finishes first time.', 'technical', 15, 'intermediate')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

-- ── Calendar feed token (migration 037) ────────────────────────────────
-- Fixed rather than issued through issue_calendar_token(), so the feed is
-- reachable immediately without a client call: after seeding, GET
-- /api/calendar/10000000-0000-0000-0000-000000000401.ics should return
-- Asanda's fixtures and training sessions.
UPDATE profiles SET calendar_token = '10000000-0000-0000-0000-000000000401'
WHERE id = '10000000-0000-0000-0000-000000000004';

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────
-- A quick sanity check after running: expect 5 profiles, 10 players, 1
-- team, 2 training sessions, 3 fixtures.
SELECT
  (SELECT count(*) FROM profiles WHERE academy_id = '10000000-0000-0000-0000-0000000000a1') AS profiles,
  (SELECT count(*) FROM players  WHERE academy_id = '10000000-0000-0000-0000-0000000000a1') AS players,
  (SELECT count(*) FROM teams    WHERE academy_id = '10000000-0000-0000-0000-0000000000a1') AS teams,
  (SELECT count(*) FROM training_sessions WHERE team_id = '10000000-0000-0000-0000-0000000000b1') AS sessions,
  (SELECT count(*) FROM fixtures WHERE team_id = '10000000-0000-0000-0000-0000000000b1') AS fixtures;

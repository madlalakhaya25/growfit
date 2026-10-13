-- 071_rls_initplan_and_function_grants.sql
--
-- Two fixes from Supabase's own database scan (performance and security
-- advisors, 2026-10-13). Nothing here changes who can read or write what.
--
-- 1. Faster row security. 89 policies call auth.uid() (and many more call the
--    no-argument helpers auth_academy_id(), auth_role() and is_admin_or_coach())
--    bare, so Postgres runs the call once for every row it checks.
--    auth_academy_id() is itself a query on profiles, so a 50-row read ran 50
--    extra queries. Wrapping the call as (select auth.uid()) lets the planner run
--    it once per statement (an "initPlan") and reuse the answer. Supabase measured
--    179 ms dropping to 9 ms for the same change:
--    https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
--    This is only safe for calls whose answer does not depend on the row, which
--    holds for all six rewritten here (none takes an argument).
--
--    The rewrite reads each policy as it stands in the database rather than
--    restating 150 policies by hand, so it also covers policies whose live text
--    differs from the migration files. Already-wrapped calls are left alone,
--    which makes it safe to re-run.
--
-- 2. Smaller attack surface for SECURITY DEFINER functions.
--    a. Trigger functions are never meant to be called through the API. Postgres
--       checks EXECUTE on a trigger function only when the trigger is created,
--       not when it fires, so revoking it changes nothing for the triggers.
--    b. RPCs the app only ever calls with a signed-in session lose the anon
--       grant. Each still checks the caller itself; this removes the reliance on
--       that check for anonymous callers. Supabase grants EXECUTE to PUBLIC by
--       default, which anon inherits, so PUBLIC is revoked too and authenticated
--       and service_role are granted back explicitly.
--    Left callable by anon on purpose: the policy helpers (a policy on a table
--    anon can read may call them, and revoking would turn an empty result into a
--    permission error), and the public entry points get_public_passport,
--    get_calendar_events, peek_access_code, find_academy_by_join_code and
--    get_shared_play.
--    c. homework_questions_valid gets a fixed search_path.
--
-- Functions or policies missing on a given database are skipped, so this can
-- run on any project whatever its migration state.

BEGIN;

-- 1. Wrap row-independent calls in policies -------------------------------

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  stmt text;
  -- Matches a bare call, but not one already inside "( SELECT ... AS ...)".
  -- Postgres deparses a wrapped call as "( SELECT auth.uid() AS uid)".
  pattern constant text :=
    '(?<!SELECT )(auth\.uid\(\)|auth\.role\(\)|auth\.jwt\(\)|auth_academy_id\(\)|auth_role\(\)|is_admin_or_coach\(\))';
  rewritten int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') ~ pattern OR coalesce(with_check, '') ~ pattern)
  LOOP
    new_qual := regexp_replace(pol.qual, pattern, '(select \1)', 'g');
    new_check := regexp_replace(pol.with_check, pattern, '(select \1)', 'g');

    stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    rewritten := rewritten + 1;
  END LOOP;

  RAISE NOTICE '071: rewrote % policies', rewritten;
END
$$;

-- 2a. Trigger functions: no direct calls from anyone ------------------------

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.add_creator_to_team_coaches()',
    'public.development_objectives_guard()',
    'public.drill_library_guard_curation()',
    'public.handle_new_user()',
    'public.homework_score_response()'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    END IF;
  END LOOP;
END
$$;

-- 2b. Signed-in-only RPCs: no anonymous calls -------------------------------

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.claim_player_by_registration(text, date)',
    'public.claim_player_profile(text, date)',
    'public.claim_team_by_coach_code(text)',
    'public.clip_consent_gaps(uuid[], text)',
    'public.delete_player_photo(uuid)',
    'public.issue_calendar_token(boolean)',
    'public.issue_parent_link_code(uuid, text)',
    'public.list_parent_link_codes(uuid)',
    'public.log_match_result(uuid, integer, integer, text, jsonb, jsonb)',
    'public.record_parent_link_failure()',
    'public.record_player_claim_failure()',
    'public.redeem_access_code(text, text, text)',
    'public.redeem_parent_link_code(text, text)',
    'public.register_academy(text, text)',
    'public.release_team_coach(uuid)',
    'public.remove_team_coach(uuid, uuid)',
    'public.reset_academy_join_code()',
    'public.reset_team_coach_code(uuid)',
    'public.revoke_parent_link_code(uuid)',
    'public.update_own_registration_numbers(text, text)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END IF;
  END LOOP;
END
$$;

-- 2c. Fixed search_path ------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.homework_questions_valid(jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.homework_questions_valid(jsonb) SET search_path = public, pg_temp;
  END IF;
END
$$;

COMMIT;

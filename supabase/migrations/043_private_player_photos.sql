-- POPIA: children's headshots were sitting in a fully public-readable
-- bucket, with no consent check anywhere the object itself gets served
-- (docs/BACKLOG.md 4.10).
--
-- `player-photos` was `public = true` with a `SELECT` policy that granted
-- the `public` role unconditionally. That policy was dead code as far as
-- anonymous access is concerned: Supabase Storage serves a public bucket's
-- objects from `/object/public/<bucket>/<path>` with no auth check and
-- without evaluating storage RLS at all -- the real gate was simply
-- "is the bucket public," which was "yes" for everyone, indefinitely.
--
-- `player_consents.photo_consent` (migration 007) already exists and is
-- already the exact rule `get_public_passport()` (023) uses to decide
-- whether to hand back a photo URL in that one JSON response -- but that
-- masking never stopped the object itself from being fetched directly by
-- anyone who already had (or guessed) the URL, since the bucket-level
-- public flag bypasses RLS regardless of what the app-level response says.
--
-- This migration is the actual enforcement point: make the bucket private,
-- so every read -- including one made through `createSignedUrl`, the only
-- way to get a working link to a private object -- is evaluated against a
-- real policy. Internal academy use (coach/admin managing their own
-- academy's players, a parent viewing their own child, a player viewing
-- themself) is unconditional, same as `players`' own RLS
-- (`player_academy_read` / `player_parent_read` / `player_self_read`,
-- migration 001/032) -- "photo consent" is about public/external sharing
-- specifically (see the consent form's own copy: "used on official Growfit
-- channels only"), not about whether academy staff can identify their own
-- players. Anonymous/public access (the passport link) additionally
-- requires `photo_consent = true` for the current season, mirroring 023's
-- own lookup exactly.
--
-- The anon/public branch needs its own SECURITY DEFINER function,
-- `player_has_current_photo_consent`, rather than a plain EXISTS against
-- `players`/`player_consents` the way the staff/self/parent branches use --
-- proven against this project (SET LOCAL ROLE anon, before writing the
-- fix, not assumed from reading the policy): `anon` has no SELECT policy on
-- either table, so a plain EXISTS is unconditionally false regardless of
-- consent, for the same reason `get_public_passport` itself has to be
-- SECURITY DEFINER. The staff/self/parent branches don't have this
-- problem -- each condition is identical to an existing `players` SELECT
-- policy, so whenever it's true, `players`' own RLS already makes that row
-- visible too.

BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'player-photos';

CREATE OR REPLACE FUNCTION public.player_has_current_photo_consent(p_player_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN player_consents pc ON pc.player_id = p.id
    WHERE p.id = p_player_id
      AND p.active = TRUE
      AND pc.season = extract(year FROM now())::text
      AND pc.photo_consent = TRUE
  );
$$;

DROP POLICY IF EXISTS "Public read player photos" ON storage.objects;
DROP POLICY IF EXISTS "player_photos_read" ON storage.objects;

-- Every upload uses the flat `<player id>.<ext>` convention (see
-- player-photo-upload.tsx / player-import.ts) -- no folder prefix -- so the
-- player a given object belongs to is the part of its name before the
-- extension.
CREATE POLICY "player_photos_read" ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'player-photos'
  AND (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id::text = split_part(storage.objects.name, '.', 1)
      AND (
        p.academy_id = auth_academy_id()
        OR p.profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM parent_player_links pl
          WHERE pl.parent_id = auth.uid() AND pl.player_id = p.id
        )
      )
    )
    OR player_has_current_photo_consent(split_part(storage.objects.name, '.', 1)::uuid)
  )
);

COMMIT;

-- Safe to re-run: the bucket update and function are idempotent, and the
-- policy is dropped and recreated.
--
-- Verified directly against this project, not just by inspection (see
-- MIGRATION_RUNBOOK.md's own methodology) -- with SET LOCAL ROLE
-- anon/authenticated and a rolled-back INSERT for the consent case:
--   * anon, no consent row for the target player -> 0 rows (denied)
--   * anon, a current-season photo_consent=true row -> 1 row (allowed)
--   * authenticated, same-academy admin -> 1 row (allowed) regardless of
--     that player's consent
--   * authenticated, unrelated profile -> 0 rows (denied)
--
-- Re-verify with:
--   SELECT public FROM storage.buckets WHERE id = 'player-photos';
-- Expect false.

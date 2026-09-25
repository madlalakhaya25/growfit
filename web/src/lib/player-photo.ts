import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "player-photos";
const MARKER = `/${BUCKET}/`;
// Long enough to outlive one page render (including print/PDF generation)
// without needing a refresh mid-view; short enough that a leaked link goes
// stale on its own.
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * `players.photo_url` stores the same `/storage/v1/object/public/...` shape
 * `getPublicUrl()` returns, even though the bucket is now private (migration
 * 043) and that exact URL 404s — it's still a reliable, already-proven way
 * (see player-photo.ts's and player-erasure.ts's own delete paths) to get
 * back the object path a signed URL needs. Upload/import never had to
 * change: they still write this same shape.
 */
export function extractPlayerPhotoPath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  const idx = photoUrl.indexOf(MARKER);
  return idx === -1 ? null : photoUrl.slice(idx + MARKER.length);
}

/**
 * Resolves one player's stored `photo_url` to a signed URL good for an
 * hour, or `null` if there's no photo or the caller isn't allowed to see it
 * (storage RLS — see migration 043 — denies the sign itself, not just the
 * later fetch, so a denied caller gets `null` here rather than a link that
 * 403s in the browser).
 */
export async function signPlayerPhotoUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  photoUrl: string | null | undefined
): Promise<string | null> {
  const path = extractPlayerPhotoPath(photoUrl);
  if (!path) return null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Batch version for a squad/list page — one storage round trip instead of
 * one per player. Returns a lookup keyed by each row's original raw
 * `photo_url` value (not the extracted path), so a caller with the row in
 * hand can look straight up by the field it already has.
 */
export async function signPlayerPhotoUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  photoUrls: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const paths = Array.from(
    new Set(photoUrls.map(extractPlayerPhotoPath).filter((p): p is string => p !== null))
  );
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const signedByPath = new Map<string, string>();
  (data ?? []).forEach((entry, i) => {
    if (entry?.signedUrl && !entry.error) signedByPath.set(paths[i], entry.signedUrl);
  });

  for (const url of photoUrls) {
    const path = extractPlayerPhotoPath(url);
    const signed = path ? signedByPath.get(path) : undefined;
    if (url && signed) result.set(url, signed);
  }
  return result;
}

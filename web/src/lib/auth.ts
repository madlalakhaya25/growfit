import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/auth-guards";
import type { UserRole } from "@/lib/types";

/** The signed-in user, as far as server code here needs to know them. */
export interface AuthUser {
  id: string;
}

/**
 * The signed-in user, or null. Cached per request.
 *
 * Reads the user from the verified sign-in token (`getClaims()`) instead of
 * asking the Auth server (`getUser()`). When the project signs tokens with
 * asymmetric keys, the token is checked locally against a cached public key,
 * so this costs no network trip; with a symmetric secret it falls back to a
 * server check, the same cost as before. Every page used to pay for up to three `getUser()`
 * round trips (proxy, layout, page) before loading any data.
 *
 * Trade-off, as Supabase documents it: a token stays valid until it expires
 * (an hour at most) even after the session is ended elsewhere. Signing out on
 * this device clears its cookies, so the token is gone here immediately.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { id } : null;
});

/** Cached per-request profile fetch — deduplicates across layout + sub-layout calls. */
export const getProfile = cache(async () => {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, academy_id, full_name, avatar_url")
    .eq("id", user.id)
    .single();
  return data ?? null;
});

/** Auth guard for server actions — returns supabase client + user or redirects. */
export async function requireUser() {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");
  return { supabase, user };
}

/** The signed-in user's role, or null when signed out. Cached with getProfile(). */
export async function getRole(): Promise<UserRole | null> {
  const profile = await getProfile();
  return (profile?.role as UserRole | undefined) ?? null;
}

export interface StaffContext {
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  user: AuthUser;
  /** Null when the caller is not coach/admin. The caller returns
   *  `{ error: "..." }` -- a Server Action must not redirect() mid-action. */
  profile: { id: string; role: UserRole; academy_id: string | null } | null;
}

/**
 * Like requireUser(), but also resolves whether the caller is staff. Still
 * redirects when signed out; deliberately does NOT redirect when merely
 * unauthorised, so an action can return a normal `{ error }` to its panel.
 */
export async function requireStaff(): Promise<StaffContext> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, academy_id")
    .eq("id", user.id)
    .single();
  const profile =
    data && isStaffRole(data.role)
      ? { id: data.id as string, role: data.role as UserRole, academy_id: (data.academy_id as string | null) ?? null }
      : null;
  return { supabase, user, profile };
}

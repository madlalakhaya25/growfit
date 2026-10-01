import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/auth-guards";
import type { UserRole } from "@/lib/types";

/** Cached per-request profile fetch — deduplicates across layout + sub-layout calls. */
export const getProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
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
  user: User;
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

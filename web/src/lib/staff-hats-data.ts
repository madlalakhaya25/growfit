// Loaders for staff hats (migration 069). They run through the signed-in user's
// session, so row security decides who may read. A database without the
// migration reads as "no hats", so every screen keeps working as before.

import type { createClient } from "@/lib/supabase/server";
import { cleanHats, type StaffHat } from "@/lib/staff-hats";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** True when migration 069 has not been run (PostgREST PGRST205, Postgres 42P01). */
export function isMissingHatsTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** The hats the signed-in person wears; none when the table is absent or unreadable. */
export async function loadOwnHats(supabase: Supabase, userId: string): Promise<StaffHat[]> {
  const { data, error } = await supabase.from("staff_hats").select("hat").eq("profile_id", userId);
  if (error) return [];
  return cleanHats(((data ?? []) as { hat: string }[]).map((r) => r.hat));
}

export interface StaffMember {
  id: string;
  name: string;
  role: "admin" | "coach";
  hats: StaffHat[];
}

export interface StaffLoad {
  /** False when the table is not there yet, so the screen can say "not set up" rather than "no staff". */
  available: boolean;
  staff: StaffMember[];
}

/** Every coach and admin of the academy with their hats, for an admin to assign. */
export async function loadStaffWithHats(supabase: Supabase, academyId: string): Promise<StaffLoad> {
  const [people, hatRows] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("academy_id", academyId)
      .in("role", ["admin", "coach"])
      .order("full_name"),
    supabase.from("staff_hats").select("profile_id, hat").eq("academy_id", academyId),
  ]);
  if (hatRows.error) return { available: !isMissingHatsTable(hatRows.error), staff: [] };

  const byPerson = new Map<string, string[]>();
  for (const r of (hatRows.data ?? []) as { profile_id: string; hat: string }[]) {
    byPerson.set(r.profile_id, [...(byPerson.get(r.profile_id) ?? []), r.hat]);
  }
  const staff = ((people.data ?? []) as { id: string; full_name: string; role: "admin" | "coach" }[]).map((p) => ({
    id: p.id,
    name: p.full_name,
    role: p.role,
    hats: cleanHats(byPerson.get(p.id)),
  }));
  return { available: true, staff };
}

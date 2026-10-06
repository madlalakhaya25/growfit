// The signed-in admin and their academy, or null for anyone else. Row security
// says the same; this gives actions a plain "Unauthorized" instead of a
// database error.

import { requireUser } from "@/lib/auth";

export async function adminContext() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.academy_id || profile.role !== "admin") return null;
  return { supabase, userId: user.id, academyId: profile.academy_id as string };
}

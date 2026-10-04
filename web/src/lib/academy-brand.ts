// The name an academy shows inside the app. The app itself is "Growfit"; each
// academy sees its own name in the header, with "Powered by Growfit" beneath.

import type { SupabaseClient } from "@supabase/supabase-js";

export const APP_NAME = "Growfit";

/** The academy's own name, or null when it has none or can't be read (the
 * header then shows the app name alone). Only ever a trimmed, bounded string. */
export async function getAcademyName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  academyId: string | null | undefined
): Promise<string | null> {
  if (!academyId) return null;
  const { data, error } = await supabase.from("academies").select("name").eq("id", academyId).maybeSingle();
  if (error || typeof data?.name !== "string") return null;
  const name = data.name.trim().slice(0, 60);
  return name === "" ? null : name;
}

"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { reportError } from "@/lib/report-error";

/**
 * Issue (or rotate) the caller's personal calendar-feed token.
 *
 * The token is minted on first request rather than at signup: nobody should
 * be carrying a live credential for a feature they have never opened.
 *
 * Rotation is the revoke story. There is no separate "disable" — a rotated
 * token immediately stops the old URL resolving, which is what someone wants
 * when a phone is lost or a link has been forwarded further than intended.
 */
export async function issueCalendarToken(rotate = false) {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("issue_calendar_token", {
    p_rotate: rotate,
  });

  if (error) {
    // 42883 is undefined_function — migration 037 has not been applied.
    if (error.code === "42883") {
      reportError(error, { scope: "issueCalendarToken", extra: { cause: "migration 037 not applied" } });
      return {
        error:
          "Calendar subscriptions aren't available yet — an administrator " +
          "needs to run the pending migration (037_calendar_feed.sql).",
      };
    }
    return { error: friendlyError(error) };
  }

  revalidatePath("/dashboard/coach/settings");
  revalidatePath("/dashboard/parent/settings");
  revalidatePath("/dashboard/player/settings");
  return { token: data as string };
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIcsCalendar, type IcsEvent, type IcsEventStatus } from "@/lib/ics";

/**
 * Subscribable calendar feed: `/api/calendar/<token>.ics`
 *
 * Fetched by a calendar client (Apple, Google, Outlook) with no cookies and
 * no ability to sign in, so the token in the path is the whole credential.
 * That shapes three decisions:
 *
 *  - It needs no `PUBLIC_PATHS` entry: `proxy.ts` already exempts every
 *    `/api` path from the session redirect, so API routes carry their own
 *    authorisation. That is load-bearing here — if the guard ever stopped
 *    exempting `/api`, this feed would start returning the login page's HTML
 *    and every subscriber's calendar would quietly go blank.
 *  - Authorisation happens inside `get_calendar_events`, a SECURITY DEFINER
 *    function, the same pattern `get_public_passport` uses. An unknown or
 *    revoked token returns no rows, so it renders as an empty calendar
 *    rather than an error a client might cache as a failed subscription.
 *  - The function returns only what/when/where. No player names, no medical
 *    details, no ID or SAFA numbers: this URL ends up synced to phones and
 *    laptops, and POPIA governs everything the academy holds about a child.
 */

/** A fixture runs longer than a training session, and both are estimates —
 *  the schema stores a start time only. Better a sensible block than a
 *  zero-length event a client renders as a bare timestamp. */
const DURATION_MINUTES = { fixture: 120, training: 90 } as const;

interface CalendarRow {
  uid: string;
  kind: string;
  title: string;
  starts_at: string;
  location: string | null;
  description: string | null;
  status: string;
  team_name: string;
}

/** Map the fixture status enum onto the three the .ics spec defines. */
function icsStatus(status: string): IcsEventStatus {
  if (status === "cancelled") return "CANCELLED";
  if (status === "postponed") return "TENTATIVE";
  return "CONFIRMED";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  void request;
  const { token: raw } = await params;
  // Clients are usually given a `.ics` URL, because some refuse to subscribe
  // to anything else. Accept both spellings.
  const token = raw.replace(/\.ics$/i, "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_calendar_events", {
    p_token: token,
  });

  if (error) {
    // Don't leak the reason: this endpoint is unauthenticated by design.
    console.error("[calendar] get_calendar_events failed:", error);
    return new NextResponse("Calendar unavailable", { status: 503 });
  }

  const rows = (data ?? []) as CalendarRow[];

  const events: IcsEvent[] = rows.map((row) => {
    const start = new Date(row.starts_at);
    const minutes =
      DURATION_MINUTES[row.kind as keyof typeof DURATION_MINUTES] ?? 60;
    return {
      uid: `${row.uid}@growfit`,
      start,
      end: new Date(start.getTime() + minutes * 60_000),
      summary: row.title,
      location: row.location,
      description: row.description,
      status: icsStatus(row.status),
    };
  });

  // Name the subscription after the team when there is exactly one, so a
  // parent with a single child sees "Growfit FA — U13" in their calendar
  // list rather than a generic label.
  const teamNames = new Set(rows.map((r) => r.team_name));
  const calendarName =
    teamNames.size === 1
      ? `Growfit FA — ${[...teamNames][0]}`
      : "Growfit FA";

  const body = buildIcsCalendar({ events, calendarName });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="growfit.ics"',
      // Short cache: a kickoff time that moved needs to reach parents in
      // minutes, not on tomorrow's poll. `private` because the URL is a
      // bearer credential and must not sit in a shared cache.
      "Cache-Control": "private, max-age=300",
    },
  });
}

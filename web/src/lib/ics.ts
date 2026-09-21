/**
 * iCalendar (RFC 5545) serialisation for the subscribable team calendar.
 *
 * Hand-rolled rather than pulled from a library: the subset needed here is
 * small, and the failure mode of getting it wrong is a feed that a calendar
 * client silently refuses to parse, which is hard to notice from the server
 * side. Everything below that looks fussy is a real rule in the spec.
 */

export type IcsEventStatus = "CONFIRMED" | "CANCELLED" | "TENTATIVE";

export interface IcsEvent {
  /** Stable across regenerations — this is what lets a client *update* an
   *  event rather than duplicate it when the feed is refetched. */
  uid: string;
  start: Date;
  /** Defaults to an hour after `start` when omitted. */
  end?: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  status?: IcsEventStatus;
  /** Bumped when the event changes, so clients accept the newer version. */
  sequence?: number;
}

/**
 * Escape a value for a text field.
 *
 * Order matters: backslashes first, or the escapes added for the other
 * characters get escaped again. Newlines become a literal `\n` two-character
 * sequence, which is what the spec means by a line break inside a value.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * UTC timestamp in the spec's basic format: `20260927T143000Z`.
 *
 * Always UTC with the trailing Z, which sidesteps VTIMEZONE entirely — a
 * client converts to the viewer's own zone. Writing local times without a
 * VTIMEZONE block is the classic way an .ics ends up hours out, and this
 * codebase has already been bitten once by `toISOString()` being treated as
 * local (see `toDateTimeLocal`).
 */
export function toIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * UTF-8 byte length of a single code point.
 *
 * Computed rather than measured with `TextEncoder` so this module stays a
 * pure function with no dependency on a global that is absent in some test
 * environments and older runtimes.
 */
function utf8Bytes(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

function utf8Length(value: string): number {
  let total = 0;
  for (const char of value) total += utf8Bytes(char.codePointAt(0)!);
  return total;
}

/**
 * Fold a content line to 75 octets, per the spec.
 *
 * Folding counts *octets*, not characters, so this measures UTF-8 bytes —
 * a naive character count splits multi-byte characters across the fold and
 * corrupts them. Continuation lines begin with a single space.
 */
export function foldIcsLine(line: string): string {
  if (utf8Length(line) <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  // First line allows 75 octets; continuations lose one to the leading space.
  let limit = 75;

  // Iterate by code point, not code unit, so an emoji or accented character
  // is never split down the middle.
  for (const char of line) {
    const charBytes = utf8Bytes(char.codePointAt(0)!);
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += charBytes;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Build a complete VCALENDAR document.
 *
 * `calendarName` reaches most clients through `X-WR-CALNAME`, which is not
 * in the spec but is what Google, Apple and Outlook actually read to label a
 * subscription. `REFRESH-INTERVAL` and the Apple-specific `X-PUBLISHED-TTL`
 * ask clients to re-poll hourly; without them some default to once a day,
 * which is too slow for a kickoff time that moved.
 */
export function buildIcsCalendar({
  events,
  calendarName,
  productId = "-//Growfit FA//Team Calendar//EN",
}: {
  events: IcsEvent[];
  calendarName: string;
  productId?: string;
}): string {
  const stamp = toIcsUtc(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    const end = event.end ?? new Date(event.start.getTime() + HOUR_MS);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(event.start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      `SEQUENCE:${event.sequence ?? 0}`,
      `STATUS:${event.status ?? "CONFIRMED"}`
    );
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF line endings are required, not stylistic — some parsers reject a
  // bare LF document outright. Trailing CRLF closes the final line.
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

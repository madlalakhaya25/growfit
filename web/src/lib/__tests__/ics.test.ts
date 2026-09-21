import { buildIcsCalendar, escapeIcsText, foldIcsLine, toIcsUtc } from "../ics";

describe("escapeIcsText", () => {
  it("escapes backslashes before anything else", () => {
    // Order matters: escaping commas first would then escape the backslashes
    // those escapes introduced, doubling them.
    expect(escapeIcsText("a\\b,c")).toBe("a\\\\b\\,c");
  });

  it("escapes the characters the spec reserves in a text value", () => {
    expect(escapeIcsText("Half-time; oranges, please")).toBe(
      "Half-time\\; oranges\\, please"
    );
  });

  it("turns real newlines into the two-character escape", () => {
    expect(escapeIcsText("line one\nline two")).toBe("line one\\nline two");
    expect(escapeIcsText("crlf\r\nhere")).toBe("crlf\\nhere");
  });
});

describe("toIcsUtc", () => {
  it("emits the basic UTC format with a trailing Z", () => {
    expect(toIcsUtc(new Date("2026-09-27T14:30:00.000Z"))).toBe("20260927T143000Z");
  });

  it("is genuinely UTC, not local", () => {
    // Writing local times without a VTIMEZONE block is the classic way an
    // .ics lands hours out. A 12:00 UTC instant must serialise as 1200Z
    // whatever zone the server happens to run in.
    expect(toIcsUtc(new Date("2026-01-05T12:00:00Z"))).toBe("20260105T120000Z");
  });
});

describe("foldIcsLine", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:U13 vs Sundowns")).toBe("SUMMARY:U13 vs Sundowns");
  });

  it("folds a long line with a leading space on continuations", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(200));
    const [first, ...rest] = folded.split("\r\n");
    expect(first.length).toBeLessThanOrEqual(75);
    for (const line of rest) expect(line.startsWith(" ")).toBe(true);
  });

  it("folds on octets, not characters, and never splits one", () => {
    // Multi-byte characters are where a naive character count corrupts the
    // output — half a character either side of a fold is not valid UTF-8.
    const folded = foldIcsLine("SUMMARY:" + "é".repeat(80));
    const utf8 = (v: string) => [...v].reduce((n, c) => n + (c.codePointAt(0)! < 0x80 ? 1 : c.codePointAt(0)! < 0x800 ? 2 : c.codePointAt(0)! < 0x10000 ? 3 : 4), 0);
    for (const line of folded.split("\r\n")) {
      expect(utf8(line)).toBeLessThanOrEqual(75);
    }
    // Unfolding restores the original exactly.
    expect(folded.split("\r\n ").join("")).toBe("SUMMARY:" + "é".repeat(80));
  });
});

describe("buildIcsCalendar", () => {
  const event = {
    uid: "fixture-abc@growfit",
    start: new Date("2026-09-27T12:00:00Z"),
    summary: "U13 vs Sundowns Academy",
  };

  it("produces a well-formed calendar envelope", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA — U13" });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
  });

  it("uses CRLF throughout, which some parsers require", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA" });
    // No bare LF anywhere.
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("gives every event a stable UID so refetching updates rather than duplicates", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA" });
    expect(ics).toContain("UID:fixture-abc@growfit");
  });

  it("defaults to a one-hour event when no end is given", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA" });
    expect(ics).toContain("DTSTART:20260927T120000Z");
    expect(ics).toContain("DTEND:20260927T130000Z");
  });

  it("honours an explicit end", () => {
    const ics = buildIcsCalendar({
      events: [{ ...event, end: new Date("2026-09-27T14:00:00Z") }],
      calendarName: "Growfit FA",
    });
    expect(ics).toContain("DTEND:20260927T140000Z");
  });

  it("marks a cancelled fixture CANCELLED rather than omitting it", () => {
    // A subscriber whose calendar already holds the event needs telling it
    // is off. A missing event just silently stays in their calendar.
    const ics = buildIcsCalendar({
      events: [{ ...event, status: "CANCELLED" }],
      calendarName: "Growfit FA",
    });
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("escapes values that would otherwise break the format", () => {
    const ics = buildIcsCalendar({
      events: [{ ...event, summary: "U13 vs Sundowns; away", location: "Chatsworth, Durban" }],
      calendarName: "Growfit FA",
    });
    expect(ics).toContain("SUMMARY:U13 vs Sundowns\\; away");
    expect(ics).toContain("LOCATION:Chatsworth\\, Durban");
  });

  it("omits optional fields rather than emitting empty ones", () => {
    const ics = buildIcsCalendar({
      events: [{ ...event, location: null, description: "" }],
      calendarName: "Growfit FA",
    });
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("names the subscription so it isn't 'Untitled' in a calendar list", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA — U13" });
    expect(ics).toContain("X-WR-CALNAME:Growfit FA — U13");
  });

  it("asks clients to re-poll hourly, not daily", () => {
    const ics = buildIcsCalendar({ events: [event], calendarName: "Growfit FA" });
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(ics).toContain("X-PUBLISHED-TTL:PT1H");
  });

  it("emits a valid empty calendar for a revoked or unknown token", () => {
    const ics = buildIcsCalendar({ events: [], calendarName: "Growfit FA" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

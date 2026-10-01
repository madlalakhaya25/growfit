import { buildSessionMemory, MEMORY_SESSIONS, type PastSession } from "../session-memory";

const s = (over: Partial<PastSession> = {}): PastSession => ({
  title: "Wednesday training", sessionType: "technical", date: "2026-09-23T15:00:00Z", notes: null,
  drills: [{ title: "Rondo", description: "LTPD Focus: First touch\n4-Corner: Technical" }, { title: "SSG", description: null }],
  attended: 12, assessed: 15, ...over,
});

describe("buildSessionMemory", () => {
  it("is null with no sessions", () => {
    expect(buildSessionMemory([])).toBeNull();
  });
  it("states turnout and what was coached, with the focus a generated drill carries", () => {
    const out = buildSessionMemory([s()])!;
    expect(out).toContain('LAST SESSION: "Wednesday training"');
    expect(out).toContain("12 of 15 marked players came");
    expect(out).toContain("- Rondo (First touch)");
    expect(out).toContain("- SSG");
    expect(out).not.toContain("SSG (");
  });
  it("is newest first whatever order it is given, and stable", () => {
    const old = s({ title: "Old", date: "2026-09-09T15:00:00Z" });
    const recent = s({ title: "Recent", date: "2026-09-23T15:00:00Z" });
    const out = buildSessionMemory([old, recent])!;
    expect(out.indexOf("Recent")).toBeLessThan(out.indexOf("Old"));
    expect(out).toBe(buildSessionMemory([recent, old]));
    expect(out).toContain("BEFORE THAT (2 sessions ago)");
  });
  it("only lists the most recent few", () => {
    const many = Array.from({ length: MEMORY_SESSIONS + 3 }, (_, i) => s({ title: `S${i}`, date: `2026-09-${String(10 + i).padStart(2, "0")}T15:00:00Z` }));
    const out = buildSessionMemory(many)!;
    expect((out.match(/"S\d+"/g) ?? []).length).toBe(MEMORY_SESSIONS);
  });
  it("invents nothing for an unmarked register or a session with no drills", () => {
    const out = buildSessionMemory([s({ assessed: 0, attended: 0, drills: [] })])!;
    expect(out).toContain("the register was not marked");
    expect(out).toContain("none were recorded");
    expect(out).not.toMatch(/0 of 0/);
  });
  it("includes a trimmed coach's note", () => {
    expect(buildSessionMemory([s({ notes: "Pitch waterlogged" })])).toContain("Coach's note: Pitch waterlogged");
    expect(buildSessionMemory([s({ notes: "   " })])).not.toContain("Coach's note");
  });
});

import { fakeSupabase } from "@/test-utils/fake-supabase";
import { audioMimeOf, cleanNoteBody, deleteCoachNotesForPlayer, loadCoachNotes, NOTE_MAX } from "../coach-notes";

describe("cleanNoteBody", () => {
  it("trims, collapses blank runs and caps the length", () => {
    expect(cleanNoteBody("  hello\r\n\r\n\r\n\r\nthere  ")).toBe("hello\n\nthere");
    expect(cleanNoteBody("x".repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX);
    expect(cleanNoteBody("   ")).toBe("");
    expect(cleanNoteBody(null)).toBe("");
  });
});

describe("audioMimeOf", () => {
  it("takes the formats browsers record, ignoring codec parameters, and nothing else", () => {
    expect(audioMimeOf("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(audioMimeOf("audio/mp4")).toBe("audio/mp4");
    expect(audioMimeOf("video/webm")).toBeNull();
    expect(audioMimeOf("")).toBeNull();
  });
});

describe("loadCoachNotes", () => {
  const rows = [
    { id: "n1", body: "a", source: "voice", created_at: "2026-10-02T10:00:00Z", author_id: "me", subject_id: "p1" },
    { id: "n2", body: "b", source: "weird", created_at: "2026-10-01T10:00:00Z", author_id: "other", subject_id: "p1" },
    { id: "n3", body: "c", source: "typed", created_at: "2026-10-01T10:00:00Z", author_id: "me", subject_id: "p2" },
  ];
  it("groups by subject, marks the reader's own notes and falls back to typed for an unknown source", async () => {
    const out = await loadCoachNotes(fakeSupabase(() => ({ data: rows })).client as never, "me", "player", ["p1", "p2"]);
    expect(out.bySubject.p1.map((n) => [n.id, n.mine, n.source])).toEqual([["n1", true, "voice"], ["n2", false, "typed"]]);
    expect(out.bySubject.p2).toHaveLength(1);
  });
  it("reads a missing table as unavailable, not an error", async () => {
    const out = await loadCoachNotes(fakeSupabase(() => ({ error: { code: "42P01" } })).client as never, "me", "player", ["p1"]);
    expect(out).toEqual({ available: false, bySubject: {} });
  });
  it("asks for nothing when there are no subjects", async () => {
    const f = fakeSupabase(() => ({ data: rows }));
    expect(await loadCoachNotes(f.client as never, "me", "player", [])).toEqual({ available: true, bySubject: {} });
    expect(f.calls).toHaveLength(0);
  });
});

describe("deleteCoachNotesForPlayer", () => {
  it("is deleted on success, and on a missing table, but not on a real failure", async () => {
    expect((await deleteCoachNotesForPlayer(fakeSupabase(() => ({})).client as never, "p1")).deleted).toBe(true);
    expect((await deleteCoachNotesForPlayer(fakeSupabase(() => ({ error: { code: "PGRST205" } })).client as never, "p1")).deleted).toBe(true);
    expect((await deleteCoachNotesForPlayer(fakeSupabase(() => ({ error: { code: "42501" } })).client as never, "p1")).deleted).toBe(false);
  });
});

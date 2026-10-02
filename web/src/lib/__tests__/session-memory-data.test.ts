import { loadRecentSessions } from "../session-memory-data";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const session = (id: string, date: string) => ({ id, title: `T-${id}`, session_type: "general", session_date: date, notes: null });

function client(sessions: unknown[], drills: unknown[] = [], marks: unknown[] = [], fail = false) {
  return fakeSupabase((op) => {
    if (fail) throw new Error("boom");
    if (op.table === "training_sessions") return { data: sessions };
    if (op.table === "training_drills") return { data: drills };
    if (op.table === "training_attendance") return { data: marks };
    return { data: null };
  }).client as never;
}

describe("loadRecentSessions", () => {
  it("attaches each session's own drills and register", async () => {
    const out = await loadRecentSessions(
      client(
        [session("a", "2026-09-23T15:00:00Z"), session("b", "2026-09-16T15:00:00Z")],
        [{ session_id: "a", title: "Rondo", description: null }, { session_id: "b", title: "SSG", description: null }],
        [
          { session_id: "a", status: "present" }, { session_id: "a", status: "late" }, { session_id: "a", status: "absent" }, { session_id: "a", status: "excused" },
          { session_id: "b", status: "present" },
        ],
      ),
      "t1", new Date("2026-10-01T00:00:00Z")
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ title: "T-a", attended: 2, assessed: 3, drills: [{ title: "Rondo" }] });
    expect(out[1]).toMatchObject({ title: "T-b", attended: 1, assessed: 1, drills: [{ title: "SSG" }] });
  });
  it("leaves out the session being planned", async () => {
    const out = await loadRecentSessions(client([session("a", "2026-09-23T15:00:00Z"), session("b", "2026-09-16T15:00:00Z")]), "t1", new Date(), "a");
    expect(out.map((s) => s.title)).toEqual(["T-b"]);
  });
  it("is empty with no sessions and never throws", async () => {
    expect(await loadRecentSessions(client([]), "t1", new Date())).toEqual([]);
    expect(await loadRecentSessions(client([], [], [], true), "t1", new Date())).toEqual([]);
  });
  it("ignores marks in a vocabulary it doesn't know", async () => {
    const out = await loadRecentSessions(client([session("a", "2026-09-23T15:00:00Z")], [], [{ session_id: "a", status: "attending" }]), "t1", new Date());
    expect(out[0]).toMatchObject({ attended: 0, assessed: 0 });
  });
});

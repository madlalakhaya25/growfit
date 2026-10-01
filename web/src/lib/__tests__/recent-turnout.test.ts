import { recentTurnout } from "../recent-turnout";
import { fakeSupabase } from "@/test-utils/fake-supabase";

function client(sessions: { id: string }[], marks: { session_id: string; status: string }[], fail = false) {
  return fakeSupabase((op) => {
    if (fail) throw new Error("boom");
    if (op.table === "training_sessions") return { data: sessions };
    if (op.table === "training_attendance") return { data: marks };
    return { data: null };
  }).client as never;
}
const m = (session_id: string, status: string) => ({ session_id, status });

describe("recentTurnout", () => {
  it("counts present and late per session, not absent or excused, and takes the median", async () => {
    const sessions = [{ id: "s3" }, { id: "s2" }, { id: "s1" }];
    const marks = [
      ...["a", "b", "c", "d"].map(() => m("s3", "present")), m("s3", "absent"), m("s3", "excused"), // 4
      ...["a", "b", "c", "d", "e", "f"].map((_, i) => m("s2", i % 2 ? "late" : "present")),            // 6
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map(() => m("s1", "present")),                        // 8
    ];
    expect(await recentTurnout(client(sessions, marks), "t1")).toBe(6);
  });
  it("is null with no sessions or no marks", async () => {
    expect(await recentTurnout(client([], []), "t1")).toBeNull();
    expect(await recentTurnout(client([{ id: "s1" }], []), "t1")).toBeNull();
  });
  it("ignores marks in a vocabulary it doesn't know", async () => {
    expect(await recentTurnout(client([{ id: "s1" }], [m("s1", "attending")]), "t1")).toBeNull();
  });
  it("never throws: a failed read just means no prefill", async () => {
    expect(await recentTurnout(client([], [], true), "t1")).toBeNull();
  });
});

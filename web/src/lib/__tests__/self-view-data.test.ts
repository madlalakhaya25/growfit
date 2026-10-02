import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadSelfView } from "@/lib/self-view-data";

function client(opts: { self?: { category: string; rating: number }[]; bands?: { category: string; band: number }[]; fail?: boolean }) {
  return fakeSupabase((op) => {
    if (opts.fail) return { error: { code: "XX000", message: "boom" } };
    if (op.table === "academy_terms") return { data: [{ id: "t1", name: "Term 4", starts_on: "2026-10-01", ends_on: "2026-12-09" }] };
    if (op.table === "player_term_reviews") return { data: (opts.bands ?? []).map((b) => ({ term_id: "t1", ...b })) };
    return { data: opts.self ?? [] };
  }).client as never;
}

const now = new Date("2026-10-20T10:00:00Z");

describe("loadSelfView", () => {
  it("returns only the categories where the child and the coach differ by a band", async () => {
    const out = await loadSelfView(
      client({
        self: [{ category: "technical", rating: 5 }, { category: "mental", rating: 3 }, { category: "tactical", rating: 1 }],
        bands: [{ category: "technical", band: 2 }, { category: "mental", band: 3 }, { category: "tactical", band: 3 }],
      }),
      "p1", "a1", now
    );
    expect(out.map((r) => r.category)).toEqual(["technical", "tactical"]);
    expect(out[0]).toEqual({ category: "technical", feels: "really good", coachSees: "Developing" });
  });

  it("is empty when the coach has not reviewed that category yet", async () => {
    expect(await loadSelfView(client({ self: [{ category: "technical", rating: 5 }] }), "p1", "a1", now)).toEqual([]);
  });

  it("never blocks a plan: a failed read is no gap", async () => {
    expect(await loadSelfView(client({ fail: true }), "p1", "a1", now)).toEqual([]);
  });
});

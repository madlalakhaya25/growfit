import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadSeasonMinutes, sumSeasonMinutes } from "../match-minutes";

describe("sumSeasonMinutes", () => {
  it("adds minutes per player and counts only matches they got on in", () => {
    const totals = sumSeasonMinutes([
      { player_id: "a", minutes_played: 30 },
      { player_id: "a", minutes_played: 25 },
      { player_id: "a", minutes_played: 0 },
      { player_id: "b", minutes_played: null },
      { player_id: "c", minutes_played: 12 },
    ]);
    expect(totals.get("a")).toEqual({ minutes: 55, matches: 2 });
    expect(totals.has("b")).toBe(false);
    expect(totals.get("c")).toEqual({ minutes: 12, matches: 1 });
  });
});

describe("loadSeasonMinutes", () => {
  it("is quietly unavailable before migration 062", async () => {
    const f = fakeSupabase(() => ({ error: { code: "42703", message: "no minutes_played" } }));
    const r = await loadSeasonMinutes(f.client as never, ["a"], "2026");
    expect(r.available).toBe(false);
    expect(r.byPlayer.size).toBe(0);
  });

  it("totals what comes back", async () => {
    const f = fakeSupabase(() => ({ data: [{ player_id: "a", minutes_played: 20 }, { player_id: "a", minutes_played: 22 }] }));
    const r = await loadSeasonMinutes(f.client as never, ["a"], "2026");
    expect(r.byPlayer.get("a")).toEqual({ minutes: 42, matches: 2 });
  });
});

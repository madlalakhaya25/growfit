import { fakeSupabase } from "@/test-utils/fake-supabase";
import { isMissingFamilyTable, loadApprovedMessages, loadFixtureStories } from "../family-messages";

const row = (over: object = {}) => ({
  id: "m1", player_id: "p1", kind: "match_story", ref_key: "f1", body: "Story", status: "approved",
  approved_by_name: "Coach K", created_at: "2026-10-01T00:00:00Z", ...over,
});

describe("isMissingFamilyTable", () => {
  it("recognises both missing-table codes and nothing else", () => {
    expect(isMissingFamilyTable({ code: "42P01" })).toBe(true);
    expect(isMissingFamilyTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingFamilyTable({ code: "42501" })).toBe(false);
    expect(isMissingFamilyTable(null)).toBe(false);
  });
});

describe("loadFixtureStories", () => {
  it("maps rows by player", async () => {
    const c = fakeSupabase(() => ({ data: [row(), row({ id: "m2", player_id: "p2", status: "draft" })] })).client as never;
    const out = await loadFixtureStories(c, "f1");
    expect(out.available).toBe(true);
    expect(out.byPlayer.get("p2")).toMatchObject({ id: "m2", status: "draft", approvedByName: "Coach K" });
  });
  it("is unavailable, not an error, when the table is missing", async () => {
    const c = fakeSupabase(() => ({ error: { code: "42P01" } })).client as never;
    expect(await loadFixtureStories(c, "f1")).toMatchObject({ available: false });
  });
  it("stays available on another error so the coach is not told to run a migration", async () => {
    const c = fakeSupabase(() => ({ error: { code: "XX000" } })).client as never;
    expect(await loadFixtureStories(c, "f1")).toMatchObject({ available: true });
  });
});

describe("loadApprovedMessages", () => {
  it("returns the rows as messages", async () => {
    const c = fakeSupabase(() => ({ data: [row()] })).client as never;
    expect(await loadApprovedMessages(c, "p1")).toEqual([
      { id: "m1", playerId: "p1", kind: "match_story", refKey: "f1", body: "Story", status: "approved", approvedByName: "Coach K", createdAt: "2026-10-01T00:00:00Z" },
    ]);
  });
  it("returns none on any error, including a missing table", async () => {
    const c = fakeSupabase(() => ({ error: { code: "42P01" } })).client as never;
    expect(await loadApprovedMessages(c, "p1")).toEqual([]);
  });
});

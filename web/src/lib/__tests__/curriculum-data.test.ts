/**
 * Loading the academy curriculum. What is tested: rows become items, an unknown
 * category is dropped rather than trusted, and a missing table reads as "not
 * set up" while any other failure reads as "empty", never as an error screen.
 */
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

import { isMissingCurriculumTable, loadCurriculum } from "../curriculum-data";
import { fakeSupabase, type FakeReply } from "@/test-utils/fake-supabase";

const load = (reply: FakeReply) => {
  const f = fakeSupabase(() => reply);
  return loadCurriculum(f.client as never).then((r) => ({ ...r, calls: f.calls }));
};

const row = (over: Record<string, unknown> = {}) => ({
  id: "i1", age_group: "U13", category: "technical", title: "Receive on the back foot",
  description: "Under light pressure", sort_order: 2, active: true, ...over,
});

it("maps rows to items", async () => {
  const { available, items } = await load({ data: [row()] });
  expect(available).toBe(true);
  expect(items).toEqual([{
    id: "i1", ageGroup: "U13", category: "technical", title: "Receive on the back foot",
    description: "Under light pressure", sortOrder: 2, active: true,
  }]);
});

it("keeps retired items, and drops a category it does not know", async () => {
  const { items } = await load({ data: [row({ active: false }), row({ id: "i2", category: "fitness" })] });
  expect(items.map((i) => [i.id, i.active])).toEqual([["i1", false]]);
});

it("is available but empty when there are no rows", async () => {
  expect(await load({ data: [] })).toMatchObject({ available: true, items: [] });
  expect(await load({ data: null })).toMatchObject({ available: true, items: [] });
});

it("says not set up when the table is missing, and empty on any other error", async () => {
  expect(await load({ error: { code: "PGRST205" } })).toMatchObject({ available: false, items: [] });
  expect(await load({ error: { code: "42P01" } })).toMatchObject({ available: false, items: [] });
  expect(await load({ error: { code: "XX000" } })).toMatchObject({ available: true, items: [] });
});

it("recognises both missing-table codes and nothing else", () => {
  expect(isMissingCurriculumTable({ code: "PGRST205" })).toBe(true);
  expect(isMissingCurriculumTable({ code: "42P01" })).toBe(true);
  expect(isMissingCurriculumTable({ code: "42703" })).toBe(false);
  expect(isMissingCurriculumTable(null)).toBe(false);
});

describe("loadLinkedItemIds", () => {
  it("returns the linked item ids, and nothing when the table is missing", async () => {
    const { loadLinkedItemIds } = await import("../curriculum-data");
    const ok = fakeSupabase(() => ({ data: [{ item_id: "a" }, { item_id: "b" }] }));
    expect(await loadLinkedItemIds(ok.client as never, "session", "s1")).toEqual(["a", "b"]);
    const missing = fakeSupabase(() => ({ error: { code: "PGRST205" } }));
    expect(await loadLinkedItemIds(missing.client as never, "session", "s1")).toEqual([]);
  });
});

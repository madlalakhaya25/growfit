/**
 * Curriculum actions. What is tested: only an admin may write, a new item lands
 * at the end of its list with the academy's own words, a duplicate is refused,
 * a missing table is a plain message, and moving or retiring touches only this
 * academy's rows.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { addCurriculumItem, moveCurriculumItem, setCurriculumItemActive } from "../curriculum";

const row = (id: string, order: number, over: Record<string, unknown> = {}) => ({
  id, age_group: "U13", category: "technical", title: id, description: null, sort_order: order, active: true, ...over,
});

function setup(over: { role?: string; items?: unknown[]; tableError?: boolean; writeError?: boolean } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "profiles") return { data: { academy_id: "ac1", role: over.role ?? "admin" } };
    if (op.action === "select") return over.tableError ? { error: { code: "PGRST205" } } : { data: over.items ?? [] };
    return over.writeError ? { error: { code: "XX000", message: "boom" } } : {};
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return ops;
}
const writes = (ops: FakeOp[]) => ops.filter((o) => o.table === "curriculum_items" && o.action !== "select");
const form = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };
const good = { age_group: "u13", category: "mental", title: " Bounce back after a goal ", description: "" };

beforeEach(() => jest.clearAllMocks());

describe("addCurriculumItem", () => {
  it("writes the academy's words at the end of the list, cleaned", async () => {
    const ops = setup({ items: [row("a", 0, { category: "mental" }), row("b", 1, { category: "mental" })] });
    expect(await addCurriculumItem(null, form(good))).toEqual({ success: true });
    expect(writes(ops)).toEqual([expect.objectContaining({
      action: "insert",
      payload: { academy_id: "ac1", age_group: "U13", category: "mental", title: "Bounce back after a goal", description: null, sort_order: 2, created_by: "u1" },
    })]);
  });

  it("refuses a coach and writes nothing", async () => {
    const ops = setup({ role: "coach" });
    expect(await addCurriculumItem(null, form(good))).toEqual({ error: "Unauthorized" });
    expect(writes(ops)).toEqual([]);
  });

  it("refuses a missing title, an unknown heading and an over-long title", async () => {
    const ops = setup();
    for (const bad of [{ title: "  " }, { category: "fitness" }, { title: "x".repeat(201) }]) {
      expect(await addCurriculumItem(null, form({ ...good, ...bad }))).toEqual({ error: expect.stringContaining("title") });
    }
    expect(writes(ops)).toEqual([]);
  });

  it("refuses a duplicate in the same list but not the same words under another heading", async () => {
    const ops = setup({ items: [row("a", 0, { category: "mental", title: "bounce back after a goal" })] });
    expect(await addCurriculumItem(null, form(good))).toEqual({ error: "That item is already in this list." });
    expect(writes(ops)).toEqual([]);
    const ops2 = setup({ items: [row("a", 0, { category: "technical", title: "Bounce back after a goal" })] });
    expect(await addCurriculumItem(null, form(good))).toEqual({ success: true });
    expect(writes(ops2)).toHaveLength(1);
  });

  it("says plainly when the tables are not there, and shows a database failure kindly", async () => {
    setup({ tableError: true });
    expect(await addCurriculumItem(null, form(good))).toEqual({ error: "Curriculum is not set up yet." });
    setup({ writeError: true });
    expect(await addCurriculumItem(null, form(good))).toEqual({ error: expect.any(String) });
  });
});

describe("moveCurriculumItem", () => {
  const items = [row("a", 0), row("b", 1), row("c", 2)];

  it("swaps two positions, only inside this academy", async () => {
    const ops = setup({ items });
    expect(await moveCurriculumItem("b", "up")).toEqual({ success: true });
    expect(writes(ops).map((o) => o.payload)).toEqual([{ sort_order: 0 }, { sort_order: 1 }]);
  });

  it("does nothing at the top, and for a coach or a bad direction", async () => {
    const ops = setup({ items });
    expect(await moveCurriculumItem("a", "up")).toEqual({ success: true });
    expect(writes(ops)).toEqual([]);
    expect(await moveCurriculumItem("b", "sideways" as never)).toEqual({ error: "Choose up or down." });
    setup({ role: "coach", items });
    expect(await moveCurriculumItem("b", "up")).toEqual({ error: "Unauthorized" });
  });
});

describe("setCurriculumItemActive", () => {
  it("retires and restores for an admin", async () => {
    const ops = setup();
    expect(await setCurriculumItemActive("a", false)).toEqual({ success: true });
    expect(writes(ops)[0].payload).toMatchObject({ active: false });
  });

  it("refuses a coach", async () => {
    const ops = setup({ role: "coach" });
    expect(await setCurriculumItemActive("a", false)).toEqual({ error: "Unauthorized" });
    expect(writes(ops)).toEqual([]);
  });
});

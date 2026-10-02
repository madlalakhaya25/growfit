const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockRedirect = jest.fn(() => { throw new Error("NEXT_REDIRECT"); });
jest.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => mockRedirect(...(a as [])) }));

import { deletePlayerRecord } from "../player-erasure";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const player = { id: "p1", full_name: "Sipho Dlamini", photo_url: null };

function setup(over: { artefactDeletes?: ({ code?: string; message?: string } | null)[]; role?: string } = {}) {
  const ops: FakeOp[] = [];
  let artefactDelete = 0;
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "profiles") return { data: { academy_id: "ac", role: over.role ?? "admin" } };
    if (op.table === "players" && op.action === "select") return { data: player };
    if (op.table === "ai_artefacts" && op.action === "delete") return { error: over.artefactDeletes?.[artefactDelete++] ?? null };
    return { data: null };
  });
  const client = { ...f.client, storage: { from: () => ({ list: async () => ({ data: [] }), remove: async () => ({}) }) } };
  mockRequireUser.mockResolvedValue({ supabase: client, user: { id: "admin1" } });
  return { ops };
}
const order = (ops: FakeOp[]) => ops.filter((o) => o.action === "delete").map((o) => o.table);

beforeEach(() => jest.clearAllMocks());

describe("deletePlayerRecord", () => {
  it("erases the player's artefacts, then the 'my job in this play' sets that name them, then the player", async () => {
    const { ops } = setup();
    await expect(deletePlayerRecord("p1", "Sipho Dlamini")).rejects.toThrow("NEXT_REDIRECT");
    expect(order(ops)).toEqual(["ai_artefacts", "ai_artefacts", "players"]);
  });
  it("stops, deleting nothing more, if the play-role sets can't be erased", async () => {
    const { ops } = setup({ artefactDeletes: [null, { code: "42501", message: "denied" }] });
    expect(await deletePlayerRecord("p1", "Sipho Dlamini")).toEqual({
      error: "Couldn't erase this player's saved AI output — nothing was deleted.",
    });
    expect(order(ops)).toEqual(["ai_artefacts", "ai_artefacts"]);
  });
  it("is for admins who type the exact name, and touches nothing otherwise", async () => {
    const coach = setup({ role: "coach" });
    expect(await deletePlayerRecord("p1", "Sipho Dlamini")).toEqual({ error: "Admins only." });
    expect(order(coach.ops)).toEqual([]);
    const wrong = setup();
    expect(await deletePlayerRecord("p1", "Someone Else")).toEqual({ error: "Name doesn't match — nothing was deleted." });
    expect(order(wrong.ops)).toEqual([]);
  });
});

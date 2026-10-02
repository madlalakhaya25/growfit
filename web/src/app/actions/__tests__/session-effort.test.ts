jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { rateSessionEffort } from "../session-effort";

function setup(over: { session?: unknown; updateResult?: { data?: unknown; error?: { code?: string; message?: string } | null } } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "training_sessions") return { data: "session" in over ? over.session : { id: "s1" } };
    if (op.table === "training_attendance" && op.action === "update") return over.updateResult ?? { data: [{ player_id: "a" }, { player_id: "b" }], error: null };
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return { ops };
}
const updates = (ops: FakeOp[]) => ops.filter((o) => o.table === "training_attendance" && o.action === "update");

beforeEach(() => jest.clearAllMocks());

describe("rateSessionEffort", () => {
  it("saves the value for the children who came and says how many", async () => {
    const { ops } = setup();
    expect(await rateSessionEffort("s1", 7)).toEqual({ success: true, count: 2 });
    expect(updates(ops)[0].payload).toEqual({ rpe: 7 });
  });

  it("refuses a value that is not one of the four words, without writing", async () => {
    const { ops } = setup();
    expect((await rateSessionEffort("s1", 6)).error).toMatch(/Easy, Okay, Hard or Very hard/);
    expect(updates(ops)).toHaveLength(0);
  });

  it("refuses a session the coach does not coach, without writing", async () => {
    const { ops } = setup({ session: null });
    expect((await rateSessionEffort("s1", 5)).error).toMatch(/not found or access denied/);
    expect(updates(ops)).toHaveLength(0);
  });

  it("names the migration when the column is not there yet", async () => {
    setup({ updateResult: { data: null, error: { code: "PGRST204", message: "no rpe" } } });
    expect((await rateSessionEffort("s1", 5)).error).toMatch(/migration 057/);
  });
});

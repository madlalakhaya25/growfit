jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoachesPlayer = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ coachesPlayer: (...a: unknown[]) => mockCoachesPlayer(...a) }));

import { setAiArtefactFeedback } from "../ai-feedback";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const coach = { user: { id: "coach-1" }, profile: { id: "coach-1", role: "coach", academy_id: "ac-1" } };

function setup(row: Record<string, unknown> | null) {
  const writes: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    if (op.action === "select") return { data: row };
    writes.push(op);
    return {};
  });
  mockRequireStaff.mockResolvedValue({ ...coach, supabase: f.client });
  return writes;
}

beforeEach(() => { jest.clearAllMocks(); mockCoachesPlayer.mockResolvedValue(true); });

describe("setAiArtefactFeedback", () => {
  it("records who and when for an academy-level result", async () => {
    const writes = setup({ id: "a1", subject_type: "academy", subject_id: "ac-1", academy_id: "ac-1" });
    expect(await setAiArtefactFeedback("a1", "helpful")).toEqual({ success: true });
    expect(writes[0].payload).toMatchObject({ feedback: "helpful", feedback_by: "coach-1" });
    expect(mockCoachesPlayer).not.toHaveBeenCalled();
  });

  it("clears all three fields on null", async () => {
    const writes = setup({ id: "a1", subject_type: "academy", subject_id: "ac-1", academy_id: "ac-1" });
    await setAiArtefactFeedback("a1", null);
    expect(writes[0].payload).toEqual({ feedback: null, feedback_by: null, feedback_at: null });
  });

  it("for a player's result, requires that the caller coaches that player", async () => {
    const writes = setup({ id: "a1", subject_type: "player", subject_id: "p1", academy_id: "ac-1" });
    mockCoachesPlayer.mockResolvedValue(false);
    expect((await setAiArtefactFeedback("a1", "helpful")).error).toMatch(/don't coach this player/);
    expect(writes).toHaveLength(0);
    expect(mockCoachesPlayer).toHaveBeenCalledWith(expect.anything(), { userId: "coach-1", role: "coach", playerId: "p1" });
  });

  it("refuses a non-staff caller and writes nothing", async () => {
    const writes: FakeOp[] = [];
    mockRequireStaff.mockResolvedValue({ user: { id: "u" }, profile: null, supabase: fakeSupabase((op) => { writes.push(op); return {}; }).client });
    expect((await setAiArtefactFeedback("a1", "helpful")).error).toMatch(/coaches and admins only/);
    expect(writes).toHaveLength(0);
  });

  it("treats another academy's result as not found", async () => {
    const writes = setup({ id: "a1", subject_type: "academy", subject_id: "ac-2", academy_id: "ac-2" });
    expect((await setAiArtefactFeedback("a1", "helpful")).error).toMatch(/no longer exists/);
    expect(writes).toHaveLength(0);
  });

  it("and a missing result the same way", async () => {
    setup(null);
    expect((await setAiArtefactFeedback("gone", "helpful")).error).toMatch(/no longer exists/);
  });
});

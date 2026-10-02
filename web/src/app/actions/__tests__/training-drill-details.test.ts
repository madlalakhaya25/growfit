/**
 * A generated drill's full plan is saved beside its 500-character description
 * (migration 052). What is tested: the plan reaches the insert, oversized or
 * malformed input is cut down before it does, and a drill with no plan writes null.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));

import { addDrills } from "../training";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const SESSION = "11111111-1111-4111-8111-111111111111";

function db() {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "team_members" || op.table === "teams") return { data: [{ id: "t1", team_id: "t1" }] };
    if (op.table === "training_sessions") return { data: { id: SESSION } };
    return { data: [] };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

const inserted = (f: ReturnType<typeof db>) =>
  f.calls.filter((c) => c.table === "training_drills" && c.action === "insert").map((c) => c.payload as unknown as Record<string, unknown>[])[0];

beforeEach(() => jest.clearAllMocks());

describe("addDrills saves the whole plan", () => {
  it("writes the plan to details, trimmed to its caps", async () => {
    const f = db();
    const res = await addDrills(SESSION, [
      {
        title: "Rondo", description: "short", video_url: "",
        details: { durationMinutes: 12, instructions: "x".repeat(5000), setup: "grid", coachingPoints: "", ltpdFocus: "", fourCorner: "" },
      },
    ]);
    expect(res).toEqual({ success: true });
    const rows = inserted(f);
    expect(rows).toHaveLength(1);
    const details = rows[0].details as { instructions: string; durationMinutes: number };
    expect(details.instructions).toHaveLength(2000);
    expect(details.durationMinutes).toBe(12);
  });

  it("writes null when there is no plan, or the plan is junk", async () => {
    const f = db();
    await addDrills(SESSION, [
      { title: "Plain", description: "", video_url: "" },
      { title: "Junk", description: "", video_url: "", details: "not a plan" },
    ]);
    const rows = inserted(f);
    expect(rows.map((r) => r.details)).toEqual([null, null]);
  });
});

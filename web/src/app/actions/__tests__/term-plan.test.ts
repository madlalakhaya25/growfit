jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["11111111-1111-4111-8111-111111111111"] }));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { addPlannedSession } from "../term-plan";

const TEAM = "11111111-1111-4111-8111-111111111111";
const input = { teamId: TEAM, date: "2026-10-14", title: "Technical: First touch", type: "technical", notes: "Edit freely." };

function setup(over: { onDay?: unknown[]; insertError?: unknown; profile?: unknown } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.action === "insert") return { error: (over.insertError as { code?: string } | null) ?? null };
    return { data: over.onDay ?? [] };
  });
  mockRequireStaff.mockResolvedValue({ supabase: f.client, user: { id: "u1" }, profile: "profile" in over ? over.profile : { role: "coach" } });
  return ops;
}
const inserts = (ops: FakeOp[]) => ops.filter((o) => o.action === "insert");

beforeEach(() => jest.clearAllMocks());

describe("addPlannedSession", () => {
  it("adds one ordinary session at the usual start, owned by the coach", async () => {
    const ops = setup();
    expect(await addPlannedSession(input)).toEqual({ success: true });
    expect(inserts(ops)[0].payload).toMatchObject({
      team_id: TEAM, coach_id: "u1", title: "Technical: First touch", session_type: "technical", session_date: "2026-10-14T17:00:00+02:00",
    });
  });

  it("never adds a second session on a day the team already trains", async () => {
    const ops = setup({ onDay: [{ id: "s1" }] });
    expect((await addPlannedSession(input)).error).toMatch(/already has a session/);
    expect(inserts(ops)).toHaveLength(0);
  });

  it("refuses a team the coach does not coach, non-staff, and a malformed session, without writing", async () => {
    const other = setup();
    expect((await addPlannedSession({ ...input, teamId: "22222222-2222-4222-8222-222222222222" })).error).toMatch(/don't coach/);
    const outsider = setup({ profile: null });
    expect((await addPlannedSession(input)).error).toMatch(/coaches and admins/);
    const bad = setup();
    expect((await addPlannedSession({ ...input, type: "nonsense" })).error).toMatch(/isn't valid/);
    expect((await addPlannedSession({ ...input, date: "14/10/2026" })).error).toMatch(/isn't valid/);
    for (const ops of [other, outsider, bad]) expect(inserts(ops)).toHaveLength(0);
  });

  it("reports a failed insert without claiming success", async () => {
    setup({ insertError: { code: "500" } });
    expect((await addPlannedSession(input)).error).toMatch(/Couldn't add/);
  });
});

/**
 * A player's RSVP is their intention, not the register. It used to be written
 * into training_attendance, where it counted as a coach mark. What is tested:
 * it goes to training_rsvps only, never touches the register, and is refused
 * once the session has started.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));

import { setAttendance } from "../training";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const HOUR = 3600 * 1000;

type Upsert = { table: string; row: Record<string, unknown> };

/** fakeSupabase doesn't model upsert, so this wraps it and records the rows upserted. */
function db(sessionStartsInMs: number | null) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "players") return { data: { id: "p1" } };
    if (op.table === "training_sessions") {
      return { data: sessionStartsInMs === null ? null : { session_date: new Date(Date.now() + sessionStartsInMs).toISOString() } };
    }
    return { data: null };
  });
  const upserts: Upsert[] = [];
  const client = {
    from(table: string) {
      const chain = f.client.from(table) as Record<string, unknown>;
      return new Proxy(chain, {
        get(t, prop: string) {
          if (prop === "upsert") return (row: Record<string, unknown>) => { upserts.push({ table, row }); return Promise.resolve({ error: null }); };
          return (t as Record<string, unknown>)[prop];
        },
      });
    },
  };
  mockRequireUser.mockResolvedValue({ supabase: client, user: { id: "u1" } });
  return { ...f, upserts };
}

beforeEach(() => jest.clearAllMocks());

describe("setAttendance (the player's RSVP)", () => {
  it("writes the RSVP to its own table and never touches the coach's register", async () => {
    const f = db(2 * HOUR);
    expect(await setAttendance("s1", "attending")).toEqual({ success: true });
    expect(f.upserts).toHaveLength(1);
    expect(f.upserts[0].table).toBe("training_rsvps");
    expect(f.upserts[0].row).toMatchObject({ session_id: "s1", player_id: "p1", response: "going" });
    expect(f.calls.some((c) => c.table === "training_attendance")).toBe(false);
  });

  it("records 'can't make it' as cant", async () => {
    const f = db(2 * HOUR);
    await setAttendance("s1", "unavailable");
    expect(f.upserts[0].row).toMatchObject({ response: "cant" });
  });

  it("refuses once the session has started, writing nothing", async () => {
    const f = db(-HOUR);
    const res = await setAttendance("s1", "attending");
    expect(res).toEqual({ error: "This session has started, so your coach takes it from here." });
    expect(f.upserts).toHaveLength(0);
  });

  it("refuses a session that can't be read", async () => {
    const f = db(null);
    expect(await setAttendance("s1", "attending")).toEqual({ error: "Session not found." });
    expect(f.upserts).toHaveLength(0);
  });
});

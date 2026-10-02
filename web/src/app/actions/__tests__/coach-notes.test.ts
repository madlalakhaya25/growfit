const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoachesPlayer = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ coachesPlayer: (...a: unknown[]) => mockCoachesPlayer(...a) }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({
  aiError: (e: unknown) => `AI-ERROR: ${e instanceof Error ? e.message : String(e)}`,
  checkAiBudget: (...a: unknown[]) => mockBudget(...a),
}));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { deleteCoachNote, saveCoachNote, transcribeCoachNote } from "../coach-notes";

const staff = { id: "u1", role: "coach", academy_id: "ac" };

function setup(over: { insertError?: { code?: string; message?: string } | null; session?: unknown; profile?: unknown } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "training_sessions") return { data: "session" in over ? over.session : { id: "s1" } };
    if (op.table === "coach_notes" && op.action === "insert") return { error: over.insertError ?? null };
    return { data: null };
  });
  mockRequireStaff.mockResolvedValue({ supabase: f.client, user: { id: "u1" }, profile: "profile" in over ? over.profile : staff });
  return { ops };
}
const inserts = (ops: FakeOp[]) => ops.filter((o) => o.table === "coach_notes" && o.action === "insert");

beforeEach(() => {
  jest.clearAllMocks();
  mockCoachesPlayer.mockResolvedValue(true);
  mockBudget.mockResolvedValue(null);
});

describe("saveCoachNote", () => {
  it("saves a cleaned note as the signed-in coach, in their academy", async () => {
    const { ops } = setup();
    expect(await saveCoachNote({ subjectType: "player", subjectId: "p1", body: "  Great week.  ", source: "voice" })).toEqual({ success: true });
    expect(inserts(ops)[0].payload).toEqual({
      academy_id: "ac", subject_type: "player", subject_id: "p1", author_id: "u1", body: "Great week.", source: "voice",
    });
  });

  it("refuses non-staff, blank notes and unknown subjects without writing", async () => {
    const outsider = setup({ profile: null });
    expect((await saveCoachNote({ subjectType: "player", subjectId: "p1", body: "x", source: "typed" })).error).toMatch(/coaches and admins/);
    const blank = setup();
    expect((await saveCoachNote({ subjectType: "player", subjectId: "p1", body: "   ", source: "typed" })).error).toBe("Write something first.");
    expect((await saveCoachNote({ subjectType: "club", subjectId: "p1", body: "x", source: "typed" })).error).toMatch(/player or a session/);
    expect(inserts(outsider.ops)).toHaveLength(0);
    expect(inserts(blank.ops)).toHaveLength(0);
  });

  it("only lets a coach write about a player they coach", async () => {
    const { ops } = setup();
    mockCoachesPlayer.mockResolvedValue(false);
    expect((await saveCoachNote({ subjectType: "player", subjectId: "p1", body: "x", source: "typed" })).error).toBe("You don't coach this player.");
    expect(inserts(ops)).toHaveLength(0);
  });

  it("only lets a coach write about a session they can see", async () => {
    const { ops } = setup({ session: null });
    expect((await saveCoachNote({ subjectType: "session", subjectId: "s9", body: "x", source: "typed" })).error).toBe("That session was not found.");
    expect(inserts(ops)).toHaveLength(0);
  });

  it("treats an unknown source as typed and explains a missing table", async () => {
    const a = setup();
    await saveCoachNote({ subjectType: "session", subjectId: "s1", body: "ok", source: "telepathy" });
    expect(inserts(a.ops)[0].payload?.source).toBe("typed");
    setup({ insertError: { code: "42P01" } });
    expect((await saveCoachNote({ subjectType: "session", subjectId: "s1", body: "ok", source: "typed" })).error).toMatch(/not switched on/);
  });
});

describe("deleteCoachNote", () => {
  it("is for staff", async () => {
    setup({ profile: null });
    expect((await deleteCoachNote("n1")).error).toMatch(/coaches and admins/);
  });
});

// jsdom's Blob has no arrayBuffer(), which the action needs; give it one.
function audio(size: number, type: string) {
  const blob = Object.assign(new Blob([new Uint8Array(size)], { type }), { arrayBuffer: async () => new ArrayBuffer(size) });
  return { get: () => blob } as unknown as FormData;
}

describe("transcribeCoachNote", () => {
  it("sends the clip inline to the model and returns only the words", async () => {
    setup();
    mockGenerate.mockResolvedValue({ text: "**Good** session, work on first touch." });
    expect(await transcribeCoachNote(audio(1000, "audio/webm;codecs=opus"))).toEqual({ text: "Good session, work on first touch." });
    const parts = mockGenerate.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData.mimeType).toBe("audio/webm");
  });

  it("refuses an empty, oversized or non-audio upload without calling the model", async () => {
    setup();
    expect((await transcribeCoachNote(audio(0, "audio/webm"))).error).toMatch(/No recording/);
    expect((await transcribeCoachNote(audio(7 * 1024 * 1024, "audio/webm"))).error).toMatch(/too long/);
    expect((await transcribeCoachNote(audio(100, "application/pdf"))).error).toMatch(/format/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("stops at the hourly AI budget, and tells the coach when nothing was heard", async () => {
    setup();
    mockBudget.mockResolvedValue("Too many requests.");
    expect((await transcribeCoachNote(audio(100, "audio/webm"))).error).toBe("Too many requests.");
    expect(mockGenerate).not.toHaveBeenCalled();
    mockBudget.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({ text: "  " });
    expect((await transcribeCoachNote(audio(100, "audio/webm"))).error).toMatch(/Couldn't hear/);
  });
});

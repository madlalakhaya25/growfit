/**
 * The consent form saves the optional video-analysis consent (migration 060),
 * and still saves the four required consents when that migration has not been
 * run yet.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));

import { savePlayerConsents, signConsentDocument } from "../records";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const four = { participation_consent: true, photo_consent: true, transport_consent: true, risk_acknowledged: true };

function setup(columnMissing: boolean) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "player_consents" && columnMissing && op.payload && "ai_analysis_consent" in op.payload) {
      return { error: { code: "PGRST204", message: "Could not find the 'ai_analysis_consent' column" } };
    }
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}
const consentWrites = (f: ReturnType<typeof setup>) => f.calls.filter((c) => c.table === "player_consents");

beforeEach(() => jest.clearAllMocks());

describe("savePlayerConsents", () => {
  it("stores the video analysis consent, including a withdrawal", async () => {
    const f = setup(false);
    expect(await savePlayerConsents("p1", "2026", { ...four, ai_analysis_consent: false, signed_by: "Mum" })).toEqual({ success: true });
    expect(consentWrites(f)).toHaveLength(1);
    expect(consentWrites(f)[0].payload).toMatchObject({ ai_analysis_consent: false });
  });

  it("still saves the required consents before migration 060 is run", async () => {
    const f = setup(true);
    expect(await savePlayerConsents("p1", "2026", { ...four, ai_analysis_consent: true, signed_by: "Mum" })).toEqual({ success: true });
    expect(consentWrites(f)).toHaveLength(2);
    expect(consentWrites(f)[1].payload).not.toHaveProperty("ai_analysis_consent");
    expect(consentWrites(f)[1].payload).toMatchObject({ photo_consent: true });
  });
});

describe("signConsentDocument", () => {
  it("passes the optional consent through and falls back the same way", async () => {
    const f = setup(true);
    expect(await signConsentDocument("p1", "2026", "Mum", { ...four, ai_analysis_consent: true })).toEqual({ success: true });
    const writes = consentWrites(f);
    expect(writes[0].payload).toMatchObject({ ai_analysis_consent: true });
    expect(writes[1].payload).not.toHaveProperty("ai_analysis_consent");
  });
});

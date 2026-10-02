import { loadSharedDevelopmentPlan, readSharedPlan } from "../shared-development-plan";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const asClient = (c: unknown) => c as SupabaseClient;

const goodPlan = {
  focusAreas: [{ category: "technical", area: "First touch", why: "It is close to a big step up." }],
  actions: [{ what: "Wall passes", how: "Ten minutes", timesPerWeek: 3, measure: "20 in a row", milestoneTemplateId: null }],
  reviewDate: "2026-11-15",
  playerNote: "You are improving every week.",
};

describe("readSharedPlan", () => {
  it("keeps the player-safe fields", () => {
    expect(readSharedPlan(goodPlan)).toEqual(goodPlan);
  });

  it("drops a coach-only field that somehow reached the stored row", () => {
    const plan = readSharedPlan({ ...goodPlan, coachNote: "Attendance is 40%, speak to parents", previous: { verdict: "not_yet" } });
    expect(plan).not.toBeNull();
    expect(JSON.stringify(plan)).not.toContain("coachNote");
    expect(JSON.stringify(plan)).not.toContain("Attendance");
    expect(JSON.stringify(plan)).not.toContain("previous");
  });

  it("ignores unknown categories and nameless actions, and returns null when nothing is left", () => {
    expect(readSharedPlan({ ...goodPlan, focusAreas: [{ category: "nonsense", area: "x", why: "y" }], actions: [{ what: "" }] })).toBeNull();
  });

  it("returns null for anything that is not a plan", () => {
    expect(readSharedPlan(null)).toBeNull();
    expect(readSharedPlan("text")).toBeNull();
    expect(readSharedPlan({ focusAreas: "no", actions: [] })).toBeNull();
  });

  it("clamps a bad timesPerWeek to once a week", () => {
    const plan = readSharedPlan({ ...goodPlan, actions: [{ what: "Run", how: "", timesPerWeek: "lots", measure: "" }] });
    expect(plan?.actions[0].timesPerWeek).toBe(1);
  });
});

describe("loadSharedDevelopmentPlan", () => {
  const row = {
    id: "a1", kind: "development_plan_shared", subject_type: "player", subject_id: "p1", data: goodPlan, prose: null,
    model_id: "m", inputs_fingerprint: "f", status: "approved", approved_by: "u1", approved_by_name: "Coach Sphe",
    approved_at: "2026-10-03T08:00:00Z", feedback: null, superseded_at: null, created_by: "u1", created_at: "2026-10-03T08:00:00Z",
  };

  it("returns the approved plan with who approved it", async () => {
    const { client } = fakeSupabase(() => ({ data: [row] }));
    const shared = await loadSharedDevelopmentPlan(asClient(client), "p1");
    expect(shared?.approvedByName).toBe("Coach Sphe");
    expect(shared?.plan.playerNote).toBe("You are improving every week.");
  });

  it("returns null when nothing is shared", async () => {
    const { client } = fakeSupabase(() => ({ data: [] }));
    expect(await loadSharedDevelopmentPlan(asClient(client), "p1")).toBeNull();
  });

  it("returns null for a row with no approval timestamp", async () => {
    const { client } = fakeSupabase(() => ({ data: [{ ...row, approved_at: null }] }));
    expect(await loadSharedDevelopmentPlan(asClient(client), "p1")).toBeNull();
  });
});

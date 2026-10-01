import { renderDevelopmentPlanProse, renderPlayerPlanProse, toPlayerSafePlan } from "../development-plan-view";
import { normaliseDevelopmentPlan, PLAN_LIMITS, type DevelopmentPlanStructured } from "../development-plan-schema";

const SECRET_NOTE = "PRIVATE: she is being bullied at school";
const SECRET_EVIDENCE = "PRIVATE: ratings fell from 4 to 2 and attendance is 40%";

const plan: DevelopmentPlanStructured = {
  playerSummary: "A composed midfielder.",
  focusAreas: [{ category: "technical", area: "First touch", why: "To keep the ball moving." }],
  actions: [{ what: "Wall passes", how: "50 a session", timesPerWeek: 3, measure: "40 clean", milestoneTemplateId: "t1" }],
  reviewDate: "2026-10-30",
  previous: { verdict: "not_yet", evidence: SECRET_EVIDENCE, carriedForward: ["PRIVATE carried"] },
  coachNote: SECRET_NOTE,
  playerNote: "You're growing fast. Keep enjoying the ball.",
};

describe("toPlayerSafePlan — the safeguarding projection", () => {
  const safe = toPlayerSafePlan(plan);

  it("carries NO coach-only key", () => {
    expect(Object.keys(safe).sort()).toEqual(["actions", "focusAreas", "playerNote", "reviewDate"]);
    expect(safe).not.toHaveProperty("coachNote");
    expect(safe).not.toHaveProperty("previous");
    expect(safe).not.toHaveProperty("playerSummary");
  });

  it("leaks no coach-only TEXT anywhere in the serialised object", () => {
    const json = JSON.stringify(safe);
    expect(json).not.toContain("PRIVATE");
    expect(json).not.toContain("bullied");
    expect(json).not.toContain(SECRET_EVIDENCE);
  });

  it("keeps what a player needs", () => {
    expect(safe.playerNote).toBe(plan.playerNote);
    expect(safe.reviewDate).toBe("2026-10-30");
    expect(safe.focusAreas[0].area).toBe("First touch");
    expect(safe.actions[0]).toMatchObject({ what: "Wall passes", timesPerWeek: 3, milestoneTemplateId: "t1" });
  });

  it("is a copy: mutating it cannot reach the coach's plan", () => {
    const s = toPlayerSafePlan(plan);
    s.focusAreas[0].area = "changed";
    s.actions[0].what = "changed";
    expect(plan.focusAreas[0].area).toBe("First touch");
    expect(plan.actions[0].what).toBe("Wall passes");
  });

  it("an extra field smuggled onto the full plan does not pass through", () => {
    const sneaky = { ...plan, secretExtra: "PRIVATE extra" } as DevelopmentPlanStructured;
    expect(JSON.stringify(toPlayerSafePlan(sneaky))).not.toContain("PRIVATE");
  });
});

describe("prose rendering", () => {
  it("the player prose contains nothing coach-only", () => {
    const text = renderPlayerPlanProse(toPlayerSafePlan(plan));
    expect(text).not.toContain("PRIVATE");
    expect(text).toContain("YOUR FOCUS: You're growing fast");
    expect(text).toContain("REVIEW DATE: 2026-10-30");
  });

  it("the coach prose includes the verdict, evidence and private note", () => {
    const text = renderDevelopmentPlanProse(plan);
    expect(text).toContain("LAST PLAN: It hasn't worked yet.");
    expect(text).toContain(SECRET_EVIDENCE);
    expect(text).toContain(`COACH NOTE: ${SECRET_NOTE}`);
  });

  it("omits the 'last plan' block when there was no previous plan, and an empty coach note", () => {
    const text = renderDevelopmentPlanProse({
      ...plan, previous: { verdict: "no_previous_plan", evidence: "", carriedForward: [] }, coachNote: "",
    });
    expect(text).not.toContain("LAST PLAN");
    expect(text).not.toContain("COACH NOTE");
  });

  it("uses the label/bullet shape AiProse parses", () => {
    const text = renderDevelopmentPlanProse(plan);
    expect(text).toMatch(/^PLAYER SUMMARY: /m);
    expect(text).toMatch(/^FOCUS AREAS:$/m);
    expect(text).toMatch(/^- Technical: First touch — /m);
    expect(text).toMatch(/^- Wall passes \(3x a week\)\./m);
  });
});

describe("normaliseDevelopmentPlan — the model's output is untrusted", () => {
  const ctx = { openMilestoneIds: new Set(["t1", "t2"]), hasPrevious: false, reviewDate: "2026-10-30" };
  const good = {
    playerSummary: "Summary.",
    playerNote: "Keep going.",
    coachNote: "A note.",
    focusAreas: [{ category: "technical", area: "First touch", why: "Why." }],
    actions: [{ what: "Wall passes", how: "50 a session", timesPerWeek: 3, measure: "40 clean", milestoneTemplateId: "t1" }],
  };

  it("accepts a good reply and stamps the server's review date", () => {
    const r = normaliseDevelopmentPlan({ ...good, reviewDate: "1999-01-01" }, ctx)!;
    expect(r.reviewDate).toBe("2026-10-30"); // never the model's
    expect(r.actions[0].milestoneTemplateId).toBe("t1");
  });

  it("returns null for null / empty / structurally unusable replies", () => {
    expect(normaliseDevelopmentPlan(null, ctx)).toBeNull();
    expect(normaliseDevelopmentPlan({}, ctx)).toBeNull();
    expect(normaliseDevelopmentPlan({ ...good, playerNote: "" }, ctx)).toBeNull();
    expect(normaliseDevelopmentPlan({ ...good, focusAreas: [] }, ctx)).toBeNull();
    expect(normaliseDevelopmentPlan({ ...good, actions: "nope" }, ctx)).toBeNull();
  });

  it("drops a milestone id that isn't one of the open milestones", () => {
    const r = normaliseDevelopmentPlan({ ...good, actions: [{ ...good.actions[0], milestoneTemplateId: "invented" }] }, ctx)!;
    expect(r.actions[0].milestoneTemplateId).toBeNull();
  });

  it("drops focus areas with an unknown category and keeps the rest", () => {
    const r = normaliseDevelopmentPlan(
      { ...good, focusAreas: [{ category: "fitness", area: "x", why: "y" }, good.focusAreas[0]] }, ctx
    )!;
    expect(r.focusAreas).toHaveLength(1);
    expect(r.focusAreas[0].category).toBe("technical");
  });

  it("caps arrays, clamps timesPerWeek, and bounds string length", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ category: "mental", area: `A${i}`, why: "w" }));
    const acts = Array.from({ length: 10 }, (_, i) => ({ what: `W${i}`, how: "h", timesPerWeek: i === 0 ? 99 : i === 1 ? -3 : 2.6, measure: "m" }));
    const r = normaliseDevelopmentPlan({ ...good, focusAreas: many, actions: acts, playerSummary: "x".repeat(5000) }, ctx)!;
    expect(r.focusAreas).toHaveLength(PLAN_LIMITS.focusAreas);
    expect(r.actions).toHaveLength(PLAN_LIMITS.actions);
    expect(r.actions[0].timesPerWeek).toBe(7);
    expect(r.actions[1].timesPerWeek).toBe(1);
    expect(r.actions[2].timesPerWeek).toBe(3);
    expect(r.playerSummary.length).toBeLessThanOrEqual(PLAN_LIMITS.summary);
  });

  it("strips markdown the prompt forbade", () => {
    const r = normaliseDevelopmentPlan({ ...good, playerNote: "**Bold** _move_ `code` # head" }, ctx)!;
    expect(r.playerNote).toBe("Bold move code head");
  });

  it("with no previous plan the verdict is 'no_previous_plan' whatever the model claimed", () => {
    const r = normaliseDevelopmentPlan({ ...good, previous: { verdict: "worked", evidence: "invented", carriedForward: ["x"] } }, ctx)!;
    expect(r.previous).toEqual({ verdict: "no_previous_plan", evidence: "", carriedForward: [] });
  });

  it("with a previous plan, takes a valid verdict and caps carried-forward", () => {
    const r = normaliseDevelopmentPlan(
      { ...good, previous: { verdict: "partly", evidence: "Two milestones done.", carriedForward: ["a", "b", "c", "d", "e"] } },
      { ...ctx, hasPrevious: true }
    )!;
    expect(r.previous.verdict).toBe("partly");
    expect(r.previous.carriedForward).toHaveLength(PLAN_LIMITS.carriedForward);
  });

  it("an invented verdict becomes 'no judgement', not a guess", () => {
    const r = normaliseDevelopmentPlan({ ...good, previous: { verdict: "great", evidence: "x" } }, { ...ctx, hasPrevious: true })!;
    expect(r.previous.verdict).toBe("no_previous_plan");
  });
});

import { MAX_HISTORY_TURNS, MAX_QUESTION_CHARS, parseAgentRequest } from "../agent-request";
import { agentSystem } from "../agent-prompt";

describe("parseAgentRequest", () => {
  it("accepts a question and trims it", () => {
    expect(parseAgentRequest({ question: "  who is low? " })).toEqual({
      ok: true,
      value: { question: "who is low?", history: [], teamId: undefined },
    });
  });
  it("rejects empty, over-long and non-object bodies", () => {
    expect(parseAgentRequest(null)).toMatchObject({ ok: false });
    expect(parseAgentRequest({ question: "   " })).toMatchObject({ ok: false });
    expect(parseAgentRequest({ question: "x".repeat(MAX_QUESTION_CHARS + 1) })).toMatchObject({ ok: false });
    expect(parseAgentRequest({ question: "q", teamId: "not-a-uuid" })).toMatchObject({ ok: false });
    expect(parseAgentRequest({ question: "q", history: "nope" })).toMatchObject({ ok: false });
    expect(parseAgentRequest({ question: "q", history: [{ role: "system", text: "x" }] })).toMatchObject({ ok: false });
  });
  it("drops trailing unanswered user turns and bounds history", () => {
    const r = parseAgentRequest({
      question: "q",
      history: [
        { role: "user", text: "a" },
        { role: "model", text: "b" },
        { role: "user", text: "failed question" },
      ],
    });
    expect(r.ok && r.value.history).toEqual([{ role: "user", text: "a" }, { role: "model", text: "b" }]);
    const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: String(i) }));
    const r2 = parseAgentRequest({ question: "q", history: long });
    expect(r2.ok && r2.value.history.length).toBeLessThanOrEqual(MAX_HISTORY_TURNS);
  });
});

describe("agentSystem", () => {
  it("overrides the brief assumption and forbids claiming writes", () => {
    const s = agentSystem();
    expect(s).toMatch(/NOT given a brief/);
    expect(s).toMatch(/only read/);
  });
  it("names the current team when one is given", () => {
    expect(agentSystem({ currentTeam: { id: "t1", name: "U13" } })).toContain('"U13"');
  });
});

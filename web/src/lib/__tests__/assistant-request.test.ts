import { assistantContents, stablePrefixContents } from "../assistant-request";

const base = {
  stableBrief: "ROSTER-TEXT",
  volatileBrief: "STATUS-TEXT",
  teamName: "U13",
  history: [{ role: "user" as const, text: "q1" }, { role: "model" as const, text: "a1" }],
  question: "q2",
};
const roles = (c: { role: string }[]) => c.map((x) => x.role);
const text = (c: { parts: { text: string }[] }[]) => c.map((x) => x.parts[0].text).join("\n");

describe("assistantContents", () => {
  it("inline: stable and volatile both sent, strictly alternating, ending on the question", () => {
    const c = assistantContents({ ...base, cached: false });
    expect(roles(c)).toEqual(["user", "model", "user", "model", "user", "model", "user"]);
    expect(text(c)).toContain("ROSTER-TEXT");
    expect(text(c)).toContain("STATUS-TEXT");
    expect(c[c.length - 1].parts[0].text).toBe("q2");
  });
  it("cached: the stable brief is NOT re-sent, the volatile one still is", () => {
    const c = assistantContents({ ...base, cached: true });
    expect(text(c)).not.toContain("ROSTER-TEXT");
    expect(text(c)).toContain("STATUS-TEXT");
    expect(roles(c)[0]).toBe("user");
  });
  it("cache prefix + cached request alternates across the boundary and equals the inline conversation", () => {
    const prefix = stablePrefixContents(base.stableBrief, base.teamName);
    const cached = assistantContents({ ...base, cached: true });
    const joined = [...prefix, ...cached];
    expect(roles(joined).every((r, i) => r === (i % 2 === 0 ? "user" : "model"))).toBe(true);
    expect(joined).toEqual(assistantContents({ ...base, cached: false }));
  });
});

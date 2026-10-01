import { parseSseBuffer } from "../agent-sse";

const frame = (e: object) => `event: x\ndata: ${JSON.stringify(e)}\n\n`;

describe("parseSseBuffer", () => {
  it("parses complete frames and keeps a partial one as rest", () => {
    const whole = frame({ type: "text", delta: "Hi" }) + frame({ type: "done" });
    const split = whole.length - 5;
    const a = parseSseBuffer(whole.slice(0, split));
    expect(a.events).toEqual([{ type: "text", delta: "Hi" }]);
    const b = parseSseBuffer(a.rest + whole.slice(split));
    expect(b.events).toEqual([{ type: "done" }]);
    expect(b.rest).toBe("");
  });
  it("skips malformed frames without dropping the rest", () => {
    const r = parseSseBuffer("data: {not json\n\n" + frame({ type: "done" }));
    expect(r.events).toEqual([{ type: "done" }]);
  });
});

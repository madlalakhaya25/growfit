import { MAX_TOOL_ROUNDS, runAgentLoop, type AgentEvent, type LoopContent, type ModelChunk } from "../run-loop";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/app/actions/welfare", () => ({ getWelfareAlerts: jest.fn() }));

async function collect(gen: AsyncGenerator<AgentEvent>) {
  const out: AgentEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const call = (name: string, args = {}, id?: string) => ({
  text: undefined,
  parts: [{ functionCall: { name, args, id }, thoughtSignature: "sig-" + name }],
  calls: [{ name, args, id }],
});

function scripted(turns: ModelChunk[][]) {
  const seen: { contents: LoopContent[]; allowTools: boolean }[] = [];
  let i = 0;
  return {
    seen,
    generate: async function* (contents: LoopContent[], opts: { allowTools: boolean }) {
      seen.push({ contents: JSON.parse(JSON.stringify(contents)), allowTools: opts.allowTools });
      for (const chunk of turns[Math.min(i++, turns.length - 1)]) yield chunk;
    },
  };
}

describe("runAgentLoop", () => {
  it("runs two tools, feeds results back, then streams the answer and links", async () => {
    const model = scripted([
      [call("getSquad", {}, "c1"), call("getAttendance", { days: 30 }, "c2")],
      [{ text: "Sipho is below ", parts: [{ text: "Sipho is below " }] }, { text: "75%.", parts: [{ text: "75%." }] }],
    ]);
    const executed: string[] = [];
    const events = await collect(
      runAgentLoop(
        {
          generate: model.generate,
          execute: async (name) => {
            executed.push(name);
            return { ok: true, data: { n: name }, links: [{ label: "Sipho", href: "/dashboard/coach/squad/p1" }] };
          },
          toError: () => "boom",
        },
        [{ role: "user", parts: [{ text: "who is low?" }] }]
      )
    );

    expect(executed).toEqual(["getSquad", "getAttendance"]);
    expect(events.filter((e) => e.type === "tool").map((e) => (e as { name: string }).name)).toEqual(["getSquad", "getAttendance"]);
    expect(events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("")).toBe("Sipho is below 75%.");
    // duplicate hrefs collapse to one chip
    expect(events.find((e) => e.type === "links")).toEqual({ type: "links", links: [{ label: "Sipho", href: "/dashboard/coach/squad/p1" }] });
    expect(events[events.length - 1]).toEqual({ type: "done" });

    // Round 2 saw the model's own parts (thought signature intact) and the tool results.
    const second = model.seen[1].contents;
    expect(second[1]).toMatchObject({ role: "model", parts: [{ thoughtSignature: "sig-getSquad" }, { thoughtSignature: "sig-getAttendance" }] });
    expect(second[2]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "getSquad", id: "c1", response: { output: { n: "getSquad" } } } },
        { functionResponse: { name: "getAttendance", id: "c2", response: { output: { n: "getAttendance" } } } },
      ],
    });
  });

  it("feeds a tool failure back as an error result the model can recover from", async () => {
    const model = scripted([[call("getPlayer")], [{ text: "I can't see that player.", parts: [] }]]);
    const events = await collect(
      runAgentLoop(
        { generate: model.generate, execute: async () => ({ ok: false, error: "Invalid arguments for getPlayer." }), toError: () => "boom" },
        [{ role: "user", parts: [{ text: "q" }] }]
      )
    );
    expect(model.seen[1].contents[2].parts[0]).toMatchObject({ functionResponse: { response: { error: "Invalid arguments for getPlayer." } } });
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("caps tool rounds, withholds tools on the last call, and ignores a stray call there", async () => {
    // The model asks for a tool every single time.
    const model = scripted([[call("getSquad")]]);
    let executions = 0;
    const events = await collect(
      runAgentLoop(
        { generate: model.generate, execute: async () => { executions++; return { ok: true, data: {}, links: [] }; }, toError: () => "boom" },
        [{ role: "user", parts: [{ text: "q" }] }]
      )
    );
    expect(executions).toBe(MAX_TOOL_ROUNDS);
    expect(model.seen).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(model.seen.slice(0, MAX_TOOL_ROUNDS).every((s) => s.allowTools)).toBe(true);
    expect(model.seen[MAX_TOOL_ROUNDS].allowTools).toBe(false);
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("maps a provider failure to a fixed message and stops without 'done'", async () => {
    const events = await collect(
      runAgentLoop(
        {
          generate: async function* () { throw new Error("429 quota exceeded for project foo"); },
          execute: async () => ({ ok: true, data: {}, links: [] }),
          toError: () => "The academy's AI quota is used up for now. Try again later.",
        },
        [{ role: "user", parts: [{ text: "q" }] }]
      )
    );
    expect(events).toEqual([{ type: "error", message: "The academy's AI quota is used up for now. Try again later." }]);
  });

  it("answers directly with no tools and no links event", async () => {
    const model = scripted([[{ text: "Hello coach.", parts: [{ text: "Hello coach." }] }]]);
    const events = await collect(
      runAgentLoop({ generate: model.generate, execute: jest.fn(), toError: () => "x" }, [{ role: "user", parts: [{ text: "hi" }] }])
    );
    expect(events).toEqual([{ type: "text", delta: "Hello coach." }, { type: "done" }]);
  });
});

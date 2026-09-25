import { useAskGrowfitStore } from "@/store/askGrowfitStore";
import type { CoachMessage } from "@/app/actions/coach-assistant";

const DEFAULTS = {
  teamId: "",
  messages: [] as CoachMessage[],
  fixtureId: "",
  formation: "11-4-3-3",
  output: null,
  applied: false,
};

beforeEach(() => {
  useAskGrowfitStore.setState(DEFAULTS);
});

describe("askGrowfitStore", () => {
  it("starts empty", () => {
    const s = useAskGrowfitStore.getState();
    expect(s.teamId).toBe("");
    expect(s.messages).toEqual([]);
    expect(s.output).toBeNull();
    expect(s.applied).toBe(false);
  });

  it("setMessages stores the whole conversation", () => {
    const messages: CoachMessage[] = [
      { role: "user", text: "Who should start on Sunday?" },
      { role: "model", text: "Based on recent form…" },
    ];
    useAskGrowfitStore.getState().setMessages(messages);
    expect(useAskGrowfitStore.getState().messages).toEqual(messages);
  });

  it("setOutput and setApplied survive independently of messages", () => {
    useAskGrowfitStore.getState().setMessages([{ role: "user", text: "hi" }]);
    useAskGrowfitStore.getState().setOutput({ kind: "lineup", text: "Suggested XI…" });
    useAskGrowfitStore.getState().setApplied(true);

    const s = useAskGrowfitStore.getState();
    expect(s.messages).toHaveLength(1);
    expect(s.output).toEqual({ kind: "lineup", text: "Suggested XI…" });
    expect(s.applied).toBe(true);
  });

  it("clearConversation resets only the chat history", () => {
    useAskGrowfitStore.getState().setMessages([{ role: "user", text: "hi" }]);
    useAskGrowfitStore.getState().setOutput({ kind: "lineup", text: "Suggested XI…" });
    useAskGrowfitStore.getState().setApplied(true);
    useAskGrowfitStore.getState().setFixtureId("fixture-1");

    useAskGrowfitStore.getState().clearConversation();

    const s = useAskGrowfitStore.getState();
    expect(s.messages).toEqual([]);
    // clearConversation is deliberately narrow — a caller switching team
    // resets output/applied/fixtureId itself, alongside it.
    expect(s.output).not.toBeNull();
    expect(s.applied).toBe(true);
    expect(s.fixtureId).toBe("fixture-1");
  });
});

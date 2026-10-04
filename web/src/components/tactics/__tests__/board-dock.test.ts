import { nextDockChoice, openDockTab } from "../board-dock";

describe("openDockTab", () => {
  it("opens Players on a blank board and nothing once players are placed", () => {
    expect(openDockTab(undefined, false)).toBe("players");
    expect(openDockTab(undefined, true)).toBeNull();
  });
  it("follows the coach's own choice over the default", () => {
    expect(openDockTab("draw", false)).toBe("draw");
    expect(openDockTab("closed", false)).toBeNull();
  });
});

describe("nextDockChoice", () => {
  it("opens the tapped tab, or closes it if it was already open", () => {
    expect(nextDockChoice(null, "move")).toBe("move");
    expect(nextDockChoice("draw", "move")).toBe("move");
    expect(nextDockChoice("move", "move")).toBe("closed");
  });
});

import { act, render, screen } from "@testing-library/react";

// Same two narrow workarounds as tactical-board.test.tsx: next/cache's
// revalidatePath (via tactic-plays.ts) needs Web-platform globals jsdom
// doesn't provide just to load, and tactics.ts pulls in @google/genai's
// ESM build which Jest's default transform can't parse. Neither mock's
// real behaviour is exercised here — with an empty teamId (the store's
// default), this panel's own [teamId] effect short-circuits before
// calling either module.
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/app/actions/tactics", () => ({
  describePlay: jest.fn(),
  analyseOpponent: jest.fn(),
}));

import { SavedPlaysPanel } from "@/components/tactics/saved-plays-panel";

describe("SavedPlaysPanel", () => {
  it("renders the plays card with no team selected, with no network calls needed", async () => {
    render(
      <SavedPlaysPanel
        ageGroup="U15"
        busy={null}
        setBusy={jest.fn()}
        notice={null}
        setNotice={jest.fn()}
        snapshot={jest.fn()}
        clearDraft={jest.fn()}
      />
    );
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Plays")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Play name e.g. High press trigger")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Share to squad")).toBeInTheDocument();
  });
});

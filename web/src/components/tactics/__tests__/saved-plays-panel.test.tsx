import { act, fireEvent, render, screen } from "@testing-library/react";

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
// Same build-graph workaround for the session-from-board action (it pulls in
// @google/genai) and the session page's addDrills; neither runs on mount.
jest.mock("@/app/actions/board-to-session", () => ({ generateSessionFromBoard: jest.fn() }));
jest.mock("@/app/actions/training", () => ({ addDrills: jest.fn() }));
jest.mock("@/app/actions/board-from-text", () => ({ generateBoardFromSentence: jest.fn() }));
jest.mock("@/app/actions/play-roles", () => ({ generatePlayRoles: jest.fn(), approvePlayRoles: jest.fn() }));

jest.mock("@/app/actions/coach-notes", () => ({ transcribeCoachNote: jest.fn() }));
jest.mock("@/app/actions/tactic-plays", () => ({
  getOpponentScouting: jest.fn().mockResolvedValue(null),
  savePlay: jest.fn(), deletePlay: jest.fn(), sharePlayToSquad: jest.fn(),
  loadPlay: jest.fn().mockResolvedValue({ name: "P1", data: { tokens: [], shapes: [] } }),
  listPlays: jest.fn().mockResolvedValue({ plays: [{ id: "p1", name: "P1", notes: null, team_id: "t", updated_at: "", concept_ids: [], session_id: null, fixture_id: null, shared: false, share_token: null, voice_url: null }] }),
  listLinkTargets: jest.fn().mockResolvedValue({ fixtures: [], sessions: [] }),
}));
// The play voice note uses the same hook, so pick out the sentence box by its 30s limit.
let captured: ((a: { blob: Blob; mime: string; ext: "webm" }) => Promise<void>) | undefined;
jest.mock("@/components/tactics/use-voice-capture", () => ({
  useVoiceCapture: (o: { maxSeconds?: number; onCaptured: typeof captured }) => { if (o.maxSeconds === 30) captured = o.onCaptured; return { recording: false, seconds: 0, error: null, setError: jest.fn(), start: jest.fn(), stop: jest.fn() }; },
}));

import { transcribeCoachNote } from "@/app/actions/coach-notes";
import { generateBoardFromSentence } from "@/app/actions/board-from-text";
import { SavedPlaysPanel } from "@/components/tactics/saved-plays-panel";
import { useBoardSetupStore } from "@/store/boardSetupStore";
import { useBoardStore } from "@/store/boardStore";
import { loadPlay, savePlay } from "@/app/actions/tactic-plays";

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

  it("lists the set-piece routines under their own heading", async () => {
    render(<SavedPlaysPanel ageGroup="U15" busy={null} setBusy={jest.fn()} notice={null} setNotice={jest.fn()} snapshot={jest.fn()} clearDraft={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    const group = screen.getByRole("group", { name: "Set pieces" });
    expect(group).toHaveTextContent("Corner routine: short and in");
    expect(group).toHaveTextContent("Defending a corner");
    expect(group).not.toHaveTextContent("High press");
  });

  it("puts what the coach says into the box for them to check, and draws nothing yet", async () => {
    (transcribeCoachNote as jest.Mock).mockResolvedValue({ text: "4-3-3, press high" });
    render(<SavedPlaysPanel ageGroup="U15" busy={null} setBusy={jest.fn()} notice={null} setNotice={jest.fn()} snapshot={jest.fn()} clearDraft={jest.fn()} />);
    await act(async () => { await captured!({ blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", ext: "webm" }); });
    expect(screen.getByLabelText("Describe a play to draw")).toHaveValue("4-3-3, press high");
    expect(generateBoardFromSentence).not.toHaveBeenCalled();
  });

  it("tells the coach when nothing was heard and leaves the box alone", async () => {
    (transcribeCoachNote as jest.Mock).mockResolvedValue({ error: "Couldn't hear anything" });
    const setNotice = jest.fn();
    render(<SavedPlaysPanel ageGroup="U15" busy={null} setBusy={jest.fn()} notice={null} setNotice={setNotice} snapshot={jest.fn()} clearDraft={jest.fn()} />);
    await act(async () => { await captured!({ blob: new Blob(["x"], { type: "audio/webm" }), mime: "audio/webm", ext: "webm" }); });
    expect(setNotice).toHaveBeenCalledWith("Couldn't hear anything");
    expect(screen.getByLabelText("Describe a play to draw")).toHaveValue("");
  });

  it("loading a play gives every sibling its own React key, so the voice note button is not duplicated", async () => {
    // The voice note recorder and the roles panel both used key={playId}. Two
    // siblings with the same key make React duplicate or drop children, which
    // showed up on a phone as a column of Voice note buttons after loading a play.
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    useBoardSetupStore.setState({ teamId: "t" });
    render(<SavedPlaysPanel ageGroup="U15" busy={null} setBusy={jest.fn()} notice={null} setNotice={jest.fn()} snapshot={jest.fn()} clearDraft={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByText("P1")); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByText("Voice note")).toHaveLength(1);
    expect(errors.mock.calls.filter((c) => String(c[0]).includes("same key"))).toHaveLength(0);
    errors.mockRestore();
    useBoardSetupStore.setState({ teamId: "" });
  });

  async function openPlayP1() {
    useBoardSetupStore.setState({ teamId: "t" });
    render(<SavedPlaysPanel ageGroup="U15" busy={null} setBusy={jest.fn()} notice={null} setNotice={jest.fn()} snapshot={jest.fn()} clearDraft={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByText("P1")); });
    await act(async () => { await Promise.resolve(); });
  }

  it("loads an old play, saved before shapes in and out of possession, with no phases", async () => {
    useBoardStore.getState().setState({ tokens: [], shapes: [], objects: [], playerNotes: [], phases: { active: "without" } });
    await openPlayP1();
    expect(useBoardStore.getState().state.phases).toBeUndefined();
    useBoardSetupStore.setState({ teamId: "" });
  });

  it("loads and saves both shapes inside the play's own JSON", async () => {
    const tok = { id: "p1", label: "1", x: 50, y: 100, kind: "player" as const, group: "Midfielder" };
    jest.mocked(loadPlay).mockResolvedValueOnce({
      name: "P1",
      data: { tokens: [tok], shapes: [], phases: { active: "with", without: [{ id: "p1", x: 50, y: 130 }] } },
    });
    await openPlayP1();
    expect(useBoardStore.getState().state.phases).toEqual({ active: "with", without: [{ id: "p1", x: 50, y: 130 }] });

    jest.mocked(savePlay).mockResolvedValueOnce({ id: "p1" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Update" })); });
    const data = jest.mocked(savePlay).mock.calls.at(-1)![0].data as { phases: unknown };
    expect(data.phases).toEqual({
      active: "with",
      with: [{ id: "p1", x: 50, y: 100 }],
      without: [{ id: "p1", x: 50, y: 130 }],
    });
    useBoardSetupStore.setState({ teamId: "" });
  });
});

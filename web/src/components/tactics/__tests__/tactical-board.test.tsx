import { act, fireEvent, render, screen } from "@testing-library/react";

// next/cache's revalidatePath (used by tactic-plays.ts, imported by
// TacticalBoard) loads Next's server-runtime request/response machinery at
// module-load time, which needs Web-platform globals (Request, Response,
// ReadableStream…) jsdom doesn't provide — a jsdom/Next.js incompatibility
// at import time, not something this test exercises. Mocking the Next.js
// framework API itself (not Supabase, not this app's own action logic) is
// the narrow fix; the real requireCoachTeam/upsert logic in tactic-plays.ts
// is untouched and this mock is never actually called by the test below,
// since teams={[]} means TacticalBoard's own effect never invokes it.
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// tactics.ts (describePlay/analyseOpponent) pulls in @google/genai, whose
// ESM build Jest's default transform doesn't process for node_modules.
// Neither function is called by anything that runs on mount (both are
// behind explicit button handlers this test never clicks), so stubbing the
// module is a build-graph workaround, not a change to tested behaviour.
jest.mock("@/app/actions/tactics", () => ({
  describePlay: jest.fn(),
  analyseOpponent: jest.fn(),
}));
// Same build-graph workaround for the session-from-board action (it pulls in
// @google/genai) and the session page's addDrills; neither runs on mount.
jest.mock("@/app/actions/board-to-session", () => ({ generateSessionFromBoard: jest.fn() }));
jest.mock("@/app/actions/training", () => ({ addDrills: jest.fn() }));
jest.mock("@/app/actions/board-from-text", () => ({ generateBoardFromSentence: jest.fn() }));
jest.mock("@/app/actions/tactic-plays", () => ({
  getOpponentScouting: jest.fn().mockResolvedValue(null),
  savePlay: jest.fn(), loadPlay: jest.fn(), deletePlay: jest.fn(), sharePlayToSquad: jest.fn(),
  listPlays: jest.fn().mockResolvedValue({ plays: [] }),
  listLinkTargets: jest.fn().mockResolvedValue({ fixtures: [], sessions: [] }),
}));
jest.mock("@/app/actions/play-roles", () => ({ generatePlayRoles: jest.fn(), approvePlayRoles: jest.fn() }));
jest.mock("@/app/actions/coach-notes", () => ({ transcribeCoachNote: jest.fn() }));

import { TacticalBoard } from "@/components/tactics/tactical-board";
import { useBoardInsightsStore } from "@/store/boardInsightsStore";
import { useBoardStore } from "@/store/boardStore";
import { useBoardSetupStore } from "@/store/boardSetupStore";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";

/**
 * The board's own state now lives in store/boardStore.ts (a zustand
 * singleton), so this is the first automated check the ongoing
 * zustand/panel-extraction refactor (docs/BACKLOG.md 3.3) can lean on — a
 * smoke render, not full interaction coverage.
 *
 * Rendered with an empty roster deliberately: TacticalBoard's own
 * useEffect on `[teamId]` calls the tactic-plays.ts server actions
 * (listPlays/listLinkTargets) unconditionally, which need a real request
 * context this test environment doesn't have. With `teams={[]}`, `teamId`
 * stays "" and both of those calls short-circuit before touching Supabase
 * — matching this repo's own no-Supabase/network-mocking test convention
 * (see web/CLAUDE.md's Testing section) rather than mocking around it.
 */
describe("TacticalBoard", () => {
  it("renders the board shell without a team roster, with no network calls needed", async () => {
    render(<TacticalBoard teams={[]} />);
    // Lets the mount-time draft-recovery check (a resolved-Promise
    // microtask, not a network call — see restoreDraft's own effect)
    // settle before asserting, so its setState doesn't warn as an
    // out-of-act update once the test body has already returned.
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Set up my XI")).toBeInTheDocument();
    expect(screen.getByText("Your team")).toBeInTheDocument();
    expect(screen.getAllByText("Opponent").length).toBeGreaterThan(0);
  });

  it("reads the opponent's shape and shades where the space is", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });

    // Default opponent shape is a 4-4-2 — set it up, then ask where the space is.
    fireEvent.click(screen.getByText("Set up opponent XI"));
    fireEvent.click(screen.getByRole("button", { name: /Find space/ }));

    expect(screen.getByTestId("exploit-layer")).toBeInTheDocument();
    const legend = screen.getByTestId("exploit-legend");
    expect(legend).toHaveTextContent("Where the space is");
    expect(legend).toHaveTextContent(/Pocket between their defence and midfield/);
  });

  it("applies an AI counter: switches our shape and draws its moves", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText("Set up opponent XI"));

    act(() => {
      useBoardInsightsStore.getState().setAiCounter({
        reading: "Flat 4-4-2.",
        exploits: [{ zoneId: "A-C", why: "Gap between the lines.", howTo: "Drop into it." }],
        counterFormationId: "11-4-2-3-1",
        counterFormationWhy: "",
        counterRuns: [{ fromZoneId: "M-C", toZoneId: "A-C", kind: "run", note: "10 into the pocket" }],
        watchOut: [],
        trainThisWeek: "",
      });
    });
    expect(screen.getByTestId("exploit-legend")).toHaveTextContent("Attacking third, centre");

    fireEvent.click(screen.getByRole("button", { name: /Apply counter — 4-2-3-1 \+ 1 move/ }));
    const { tokens, shapes } = useBoardStore.getState().state;
    expect(tokens.filter((t) => t.kind === "player")).toHaveLength(11);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].kind).toBe("run");
    expect(screen.getByText(/Switched to 4-2-3-1 and drew 1 suggested move/)).toBeInTheDocument();
  });

  it("keeps the setup cards open on a blank board and folds them once players are placed", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    const setup = screen.getByText("Set up teams and pitch").closest("details");
    expect(setup).toHaveProperty("open", true);
    act(() => {
      useBoardStore.getState().setState({
        tokens: [{ id: "p1", label: "1", x: 50, y: 100, kind: "player", group: "Midfielder" }],
        shapes: [], objects: [], playerNotes: [],
      });
    });
    expect(screen.getByText("Set up teams and pitch").closest("details")).toHaveProperty("open", false);
  });

  it("starts a U11 team in nine-a-side shapes and a U15 team in eleven-a-side", async () => {
    const team = (age: string) => ({ id: "t1", name: "Team", age_group: age, players: [] });
    const { unmount } = render(<TacticalBoard teams={[team("U11")]} />);
    await act(async () => { await Promise.resolve(); });
    expect((screen.getAllByLabelText("Formation")[0] as HTMLSelectElement).value).toMatch(/^9-/);
    expect((screen.getAllByLabelText("Formation")[1] as HTMLSelectElement).value).toMatch(/^9-/);
    unmount();
    render(<TacticalBoard teams={[team("U15")]} />);
    await act(async () => { await Promise.resolve(); });
    expect((screen.getAllByLabelText("Formation")[0] as HTMLSelectElement).value).toMatch(/^11-/);
  });

  it("draws passing lanes from the player on the ball", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    act(() => {
      useBoardStore.getState().setState({
        tokens: [
          { id: "p1", label: "1", x: 50, y: 100, kind: "player", group: "Midfielder" },
          { id: "p2", label: "2", x: 20, y: 100, kind: "player", group: "Midfielder" },
          { id: "p3", label: "3", x: 50, y: 60, kind: "player", group: "Forward" },
          { id: "o1", label: "", x: 50, y: 80, kind: "opponent", group: "Opponent" },
          { id: "b", label: "", x: 51, y: 101, kind: "ball", group: "Ball" },
        ],
        shapes: [], objects: [], playerNotes: [],
      });
    });
    fireEvent.click(screen.getByRole("button", { name: /Passing lanes/ }));
    const layer = screen.getByTestId("lanes-layer");
    expect(layer.querySelectorAll("line")).toHaveLength(2);
    expect(layer).toHaveTextContent("1 open pass · 0 forward");
  });

  it("shows the offside line and each side's line gaps", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Space control/ }));
    expect(screen.getByTestId("space-layer")).toHaveTextContent("needs both teams");

    fireEvent.click(screen.getByText("Set up my XI"));
    fireEvent.click(screen.getByText("Set up opponent XI"));
    fireEvent.click(screen.getByRole("button", { name: /Offside & lines/ }));
    fireEvent.click(screen.getByRole("button", { name: /Numbers/ }));
    expect(screen.getByTestId("lines-layer")).toHaveTextContent("Offside line");
    expect(screen.getByTestId("space-layer")).toHaveTextContent(/We own \d+%/);
    expect(screen.getByTestId("numbers-layer")).toHaveTextContent(/\dv\d/);
  });

  it("shows only the style options that apply to the current tool", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("button", { name: "Bend left" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Shot tool" }));
    expect(screen.getByRole("button", { name: "Bend left" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lasso" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Zone tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Oval" }));
    expect(screen.getByRole("button", { name: "Oval" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hatched" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bend left" })).toBeNull();
  });

  it("builds a press around the opponent on the ball and lists each player's job", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    act(() => {
      useBoardStore.getState().setState({
        tokens: [
          { id: "ball", label: "", x: 50, y: 60, kind: "ball", group: "Ball" },
          { id: "c", label: "6", x: 50, y: 58, kind: "opponent", group: "Opponent" },
          { id: "o1", label: "7", x: 30, y: 55, kind: "opponent", group: "Opponent" },
          { id: "o2", label: "8", x: 70, y: 55, kind: "opponent", group: "Opponent" },
          { id: "p1", label: "Sipho", x: 50, y: 75, kind: "player", group: "Midfielder" },
          { id: "p2", label: "Thabo", x: 35, y: 80, kind: "player", group: "Midfielder" },
          { id: "p3", label: "Lwazi", x: 65, y: 80, kind: "player", group: "Midfielder" },
        ],
        shapes: [], objects: [], playerNotes: [],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Build press/ }));
    const shapes = useBoardStore.getState().state.shapes;
    expect(shapes.map((sh) => sh.kind)).toEqual(["press", "run", "run"]);
    expect(screen.getByText(/Press drawn: 1 presser, 2 cutting the passing lanes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Player jobs/ }));
    const jobs = screen.getByTestId("player-jobs");
    expect(jobs).toHaveTextContent(/Sipho.*1\. Press \d+m/);

    fireEvent.click(screen.getByRole("button", { name: /Run times/ }));
    expect(screen.getByTestId("times-layer").querySelectorAll("text")).toHaveLength(3);
  });

  it("asks for a ball at an opponent's feet before building a press", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: /Build press/ }));
    expect(screen.getByText(/Put the ball at an opponent's feet first/)).toBeInTheDocument();
  });

  it("switches the pitch look and the 3D view", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    const floodlit = screen.getByRole("radio", { name: /Floodlit/ });
    fireEvent.click(floodlit);
    expect(floodlit).toHaveAttribute("aria-checked", "true");
    expect(useBoardSetupStore.getState().pitchThemeId).toBe("night");

    const threeD = screen.getByRole("button", { name: "3D" });
    expect(threeD).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(threeD);
    expect(threeD).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/3D view · switch to 2D to edit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(screen.queryByText(/3D view · switch to 2D to edit/)).not.toBeInTheDocument();
  });

  it("flips our team between its shape with and without the ball", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("group", { name: "Our shape" })).not.toBeInTheDocument();
    act(() => {
      useBoardStore.getState().setState({
        tokens: [
          { id: "p1", label: "1", x: 50, y: 100, kind: "player", group: "Midfielder" },
          { id: "o1", label: "", x: 50, y: 40, kind: "opponent", group: "Opponent" },
        ],
        shapes: [], objects: [], playerNotes: [],
      });
    });

    const withBall = screen.getByRole("button", { name: "With the ball" });
    const withoutBall = screen.getByRole("button", { name: "Without the ball" });
    expect(withBall).toHaveAttribute("aria-pressed", "true");

    // First time: "without" starts as a copy of the current shape.
    fireEvent.click(withoutBall);
    expect(withoutBall).toHaveAttribute("aria-pressed", "true");
    expect(useBoardStore.getState().state.phases?.active).toBe("without");
    expect(useBoardStore.getState().state.tokens[0]).toMatchObject({ x: 50, y: 100 });

    // Drop deep while out of possession, then flip back and forth. (Each
    // flip starts a short glide; end it so the next flip isn't blocked.)
    act(() => {
      useBoardPlaybackStore.getState().setPlaying(false);
      useBoardStore.getState().setState((st) => ({ ...st, tokens: st.tokens.map((t) => (t.id === "p1" ? { ...t, y: 130 } : t)) }));
    });
    fireEvent.click(withBall);
    expect(useBoardStore.getState().state.tokens[0]).toMatchObject({ x: 50, y: 100 });
    act(() => { useBoardPlaybackStore.getState().setPlaying(false); });
    fireEvent.click(screen.getByRole("button", { name: "Without the ball" }));
    expect(useBoardStore.getState().state.tokens[0]).toMatchObject({ x: 50, y: 130 });
    expect(useBoardStore.getState().state.tokens[1]).toMatchObject({ x: 50, y: 40 });
  });

  it("puts the step timeline and Save as video under the pitch", async () => {
    render(<TacticalBoard teams={[]} />);
    await act(async () => { await Promise.resolve(); });
    // jsdom has no MediaRecorder, so the button explains instead of failing.
    expect(screen.getByRole("button", { name: "Save as video" })).toBeDisabled();
    expect(screen.getByText(/can't save video/i)).toBeInTheDocument();

    act(() => {
      useBoardPlaybackStore.getState().setFrames([
        { id: "f1", tokens: [{ id: "p1", x: 50, y: 100 }], shapes: [] },
        { id: "f2", tokens: [{ id: "p1", x: 50, y: 80 }], shapes: [], durationMs: 2000 },
      ]);
    });
    expect(screen.getByRole("slider", { name: "Scrub through the move" })).toHaveAttribute("max", "2000");
  });
});

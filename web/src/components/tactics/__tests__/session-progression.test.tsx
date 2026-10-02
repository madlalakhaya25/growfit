import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockAddDrills = jest.fn();
jest.mock("@/app/actions/training", () => ({ addDrills: (...a: unknown[]) => mockAddDrills(...a) }));

import { SessionProgression } from "../session-progression";

const d = (name: string) => ({
  name, durationMinutes: 10, ltpdFocus: "Passing", fourCorner: "Technical",
  setup: "20x15m", instructions: "1. Pass.", coachingPoints: "Open body",
});
const plan = { drills: [d("Unopposed"), d("Opposed"), d("SSG")], coachReflection: "Q?" };
const sessions = [{ id: "s1", when: "Wed", label: "U13 training" }, { id: "s2", when: "Fri", label: "U13 training" }];

beforeEach(() => { jest.resetAllMocks(); mockAddDrills.mockResolvedValue({ success: true }); });

describe("SessionProgression", () => {
  it("shows the three drills", () => {
    render(<SessionProgression plan={plan} sessions={sessions} />);
    expect(screen.getByText(/DRILL 1: Unopposed/)).toBeInTheDocument();
    expect(screen.getByText(/DRILL 3: SSG/)).toBeInTheDocument();
  });
  it("won't add until a session is chosen", () => {
    render(<SessionProgression plan={plan} sessions={sessions} />);
    fireEvent.click(screen.getByRole("button", { name: /add to session/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/choose a session/i);
    expect(mockAddDrills).not.toHaveBeenCalled();
  });
  it("preselects the play's attached session and adds all three drills through addDrills", async () => {
    const onApplied = jest.fn();
    render(<SessionProgression plan={plan} sessions={sessions} defaultSessionId="s2" onApplied={onApplied} />);
    fireEvent.click(screen.getByRole("button", { name: /add to session/i }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    const [sessionId, drills] = mockAddDrills.mock.calls[0];
    expect(sessionId).toBe("s2");
    expect(drills.map((x: { title: string }) => x.title)).toEqual(["Unopposed", "Opposed", "SSG"]);
    expect(screen.getByRole("button", { name: "Added" })).toBeDisabled();
  });
  it("ignores a default session the team doesn't have", () => {
    render(<SessionProgression plan={plan} sessions={sessions} defaultSessionId="other" />);
    expect(screen.getByLabelText(/add to training session/i)).toHaveValue("");
  });
  it("shows the action's error and lets the coach retry", async () => {
    mockAddDrills.mockResolvedValue({ error: "Session not found." });
    render(<SessionProgression plan={plan} sessions={sessions} defaultSessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /add to session/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Session not found.");
    expect(screen.getByRole("button", { name: /add to session/i })).not.toBeDisabled();
  });
});

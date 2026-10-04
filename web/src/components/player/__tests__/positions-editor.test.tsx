import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockOfficial = jest.fn();
const mockPreferred = jest.fn();
jest.mock("@/app/actions/player-positions", () => ({
  setOfficialPositions: (...a: unknown[]) => mockOfficial(...a),
  setPreferredPositions: (...a: unknown[]) => mockPreferred(...a),
}));

import { PositionsEditor } from "../positions-editor";

beforeEach(() => {
  jest.clearAllMocks();
  mockOfficial.mockResolvedValue({ success: true });
  mockPreferred.mockResolvedValue({ success: true });
});

describe("PositionsEditor", () => {
  it("shows what the player likes beside what the coach set", () => {
    render(<PositionsEditor playerId="p1" kind="official" initial={[{ position: "lw", role: "touchline_winger" }]} other={[{ position: "lw", role: "inside_forward" }]} />);
    expect(screen.getByText(/Likes:/).parentElement).toHaveTextContent("Left Winger · Inside forward");
  });

  it("saves the coach's choice with its role through the official action", async () => {
    render(<PositionsEditor playerId="p1" kind="official" initial={[{ position: "cm", role: null }]} other={[]} />);
    fireEvent.change(screen.getByLabelText("Main role"), { target: { value: "box_to_box" } });
    fireEvent.click(screen.getByRole("button", { name: "Save positions" }));
    await waitFor(() => expect(mockOfficial).toHaveBeenCalledWith("p1", [{ position: "cm", role: "box_to_box" }]));
    expect(mockPreferred).not.toHaveBeenCalled();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("uses the preferred action for a player, and drops the role when the position changes", async () => {
    render(<PositionsEditor playerId="p1" kind="preferred" initial={[{ position: "cm", role: "box_to_box" }]} other={[]} />);
    fireEvent.change(screen.getByLabelText("Main position"), { target: { value: "st" } });
    expect(screen.getByLabelText("Main role")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save positions" }));
    await waitFor(() => expect(mockPreferred).toHaveBeenCalledWith("p1", [{ position: "st", role: null }]));
  });

  it("adds up to three positions, never repeating one, and shows an error from the action", async () => {
    mockOfficial.mockResolvedValue({ error: "nope" });
    render(<PositionsEditor playerId="p1" kind="official" initial={[{ position: "gk", role: null }]} other={[]} />);
    fireEvent.click(screen.getByText("Add a position"));
    fireEvent.click(screen.getByText("Add a position"));
    expect(screen.queryByText("Add a position")).toBeNull();
    const options = Array.from((screen.getByLabelText("Second position") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).not.toContain("gk");
    fireEvent.click(screen.getByRole("button", { name: "Save positions" }));
    expect(await screen.findByText("nope")).toBeInTheDocument();
  });
});

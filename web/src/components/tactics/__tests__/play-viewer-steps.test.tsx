import { render, screen, fireEvent } from "@testing-library/react";
import { PlayViewer, type PlayData } from "../play-viewer";

const tokens = [
  { id: "a", label: "Ayo", kind: "player" as const, group: "Midfielder", x: 10, y: 100 },
  { id: "b", label: "Bo", kind: "player" as const, group: "Forward", x: 50, y: 60 },
];
const run = { id: "s1", kind: "run" as const, pts: [{ x: 10, y: 100 }, { x: 10, y: 95 }] };
const pass = { id: "s2", kind: "pass" as const, pts: [{ x: 10, y: 95 }, { x: 50, y: 60 }] };
const data: PlayData = {
  tokens,
  shapes: [run, pass],
  frames: [
    { id: "f0", tokens: [{ id: "a", x: 10, y: 100 }, { id: "b", x: 50, y: 60 }], shapes: [] },
    { id: "f1", tokens: [{ id: "a", x: 10, y: 95 }, { id: "b", x: 50, y: 60 }], shapes: [run] },
    { id: "f2", tokens: [{ id: "a", x: 10, y: 95 }, { id: "b", x: 50, y: 60 }], shapes: [run, pass] },
  ],
};

describe("PlayViewer step by step", () => {
  it("walks one move at a time, saying what happens in each", () => {
    render(<PlayViewer data={data} />);
    expect(screen.queryByTestId("play-step")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Step by step" }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Ayo runs.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("Ayo passes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByText("Where everyone starts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
  });

  it("leaves step mode on Reset", () => {
    render(<PlayViewer data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Step by step" }));
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.queryByTestId("play-step")).toBeNull();
  });
});

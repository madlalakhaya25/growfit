import { act, fireEvent, render, screen } from "@testing-library/react";
import { SessionRunner, formatElapsed } from "@/components/training/session-runner";

const drills = [
  { id: "d1", title: "Rondo 4v2", description: "Keep the ball" },
  { id: "d2", title: "Finishing", description: null },
];

describe("formatElapsed", () => {
  it("shows minutes and zero-padded seconds, with minutes unbounded", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65)).toBe("1:05");
    expect(formatElapsed(3600)).toBe("60:00");
    expect(formatElapsed(-4)).toBe("0:00");
  });
});

describe("SessionRunner", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("renders nothing for a session with no drills", () => {
    const { container } = render(<SessionRunner drills={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("steps through drills and times each one on its own", () => {
    render(<SessionRunner drills={drills} />);
    fireEvent.click(screen.getByRole("button", { name: /Run this session/ }));
    expect(screen.getByText("Rondo 4v2")).toBeInTheDocument();
    expect(screen.getByText("Drill 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByRole("timer")).toHaveTextContent("0:03");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByRole("timer")).toHaveTextContent("0:03");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Finishing")).toBeInTheDocument();
    expect(screen.getByText("Drill 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Rondo 4v2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("resets the stopwatch without changing drill", () => {
    render(<SessionRunner drills={drills} />);
    fireEvent.click(screen.getByRole("button", { name: /Run this session/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => { jest.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    expect(screen.getByText("Rondo 4v2")).toBeInTheDocument();
  });

  it("shows a drill's saved plan in place of its cut-down description", () => {
    const planned = [{
      id: "d3", title: "Press trap", description: "cut down desc",
      details: { durationMinutes: 12, ltpdFocus: "", fourCorner: "Tactical", setup: "Half pitch", instructions: "Full instructions here", coachingPoints: "Show them inside" },
    }];
    render(<SessionRunner drills={planned} />);
    fireEvent.click(screen.getByRole("button", { name: /Run this session/ }));
    expect(screen.getByText("Full instructions here")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.queryByText("cut down desc")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { VerdictList } from "../verdict-list";

describe("VerdictList", () => {
  it("says what to draw when there is nothing to read yet", () => {
    render(<VerdictList verdict={{ items: [], good: 0, risky: 0, poor: 0 }} />);
    expect(screen.getByText(/Draw a pass or a run/)).toBeInTheDocument();
  });

  it("spells each level out in words, with a count line", () => {
    render(
      <VerdictList
        verdict={{
          items: [
            { shapeId: "a", level: "good", text: "A to B: clear lane, onside." },
            { shapeId: "b", level: "risky", text: "C's run is a close race with X." },
            { shapeId: "c", level: "poor", text: "D to E: a defender is in the way." },
          ],
          good: 1, risky: 1, poor: 1,
        }}
      />
    );
    expect(screen.getByText("1 look on, 1 risky, 1 unlikely.")).toBeInTheDocument();
    expect(screen.getByText("Looks on.")).toBeInTheDocument();
    expect(screen.getByText("Risky.")).toBeInTheDocument();
    expect(screen.getByText("Unlikely.")).toBeInTheDocument();
    expect(screen.getByText(/D to E: a defender is in the way/)).toBeInTheDocument();
  });
});

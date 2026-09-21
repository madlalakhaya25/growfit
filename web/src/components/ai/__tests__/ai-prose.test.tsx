import { render, screen } from "@testing-library/react";
import { AiProse } from "../ai-prose";

/**
 * These assert the two things the old per-panel renderers got wrong: that a
 * structural label is recognised at all (the previous regex only matched
 * *numbered* labels, so the coach assistant's own `BENCH:` / `SHAPE:` formats
 * never matched anywhere), and that an ordinary sentence is not mistaken for
 * one.
 */
describe("AiProse", () => {
  it("renders every line of the answer", () => {
    render(<AiProse text={"First line\nSecond line"} />);
    expect(screen.getByText("First line")).toBeInTheDocument();
    expect(screen.getByText("Second line")).toBeInTheDocument();
  });

  it("recognises an unnumbered ALL-CAPS label, which the old regex could not", () => {
    render(<AiProse text={"STARTING XI:"} />);
    const label = screen.getByText("STARTING XI");
    expect(label.className).toContain("uppercase");
  });

  it("recognises a numbered label", () => {
    render(<AiProse text={"1. SQUAD HEALTH:"} />);
    expect(screen.getByText("SQUAD HEALTH")).toBeInTheDocument();
  });

  it("keeps a label and its value on one line", () => {
    render(<AiProse text={"SHAPE: 4-3-3"} />);
    expect(screen.getByText("4-3-3")).toBeInTheDocument();
    expect(screen.getByText(/SHAPE/)).toBeInTheDocument();
  });

  it("does not treat an ordinary sentence as a label", () => {
    // Starts with an acronym and contains a colon later — must stay body copy.
    const line = "Thabo has not trained since the 3rd: check in with his parents.";
    render(<AiProse text={line} />);
    expect(screen.getByText(line)).toBeInTheDocument();
  });

  it("renders a dash bullet as a bullet", () => {
    render(<AiProse text={"- Press the first pass"} />);
    expect(screen.getByText("Press the first pass")).toBeInTheDocument();
  });

  it("renders the answer as body copy, not muted micro-text", () => {
    // The regression this component exists to prevent: the assistant used to
    // render the model's reply as `text-xs text-muted-foreground` while
    // rendering the coach's own question in high-contrast primary.
    const { container } = render(<AiProse text="Play Sipho at right back." />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("text-sm");
    expect(root.className).toContain("text-foreground");
    expect(root.className).not.toContain("text-muted-foreground");
  });
});

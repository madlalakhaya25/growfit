import { render, screen } from "@testing-library/react";
import { TermGrowthCard } from "../term-growth-card";

describe("TermGrowthCard", () => {
  it("shows growth in words, with no scores", () => {
    const { container } = render(
      <TermGrowthCard termName="Term 2 2026" current={{ technical: 3, mental: 2 }} last={{ technical: 1 }} />
    );
    expect(screen.getByText("Technical: moved up from Emerging to Secure.")).toBeInTheDocument();
    expect(screen.getByText("Mental: Developing this term.")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d\s*\/\s*\d|score|rank/i);
  });

  it("renders nothing until a category has been reviewed", () => {
    const { container } = render(<TermGrowthCard termName="Term 2 2026" current={{}} last={{ technical: 2 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not show an area the coach has not reviewed yet", () => {
    render(<TermGrowthCard termName="T" current={{ tactical: 2 }} last={{ technical: 4 }} />);
    expect(screen.queryByText(/Technical/)).toBeNull();
  });
});

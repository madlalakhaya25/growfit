jest.mock("@/app/actions/self-assessment", () => ({ saveSelfAssessment: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SelfRatingCard } from "../self-rating-card";
import { saveSelfAssessment } from "@/app/actions/self-assessment";

beforeEach(() => jest.clearAllMocks());

describe("SelfRatingCard", () => {
  it("saves the answer for the category and shows it back as a label", async () => {
    render(<SelfRatingCard termId="t1" termName="Term 2 2026" ageGroup="U15" initial={{}} />);
    const technical = screen.getByRole("group", { name: "Technical" });
    fireEvent.click(technical.querySelector('button[aria-label="Good"]') as HTMLElement);
    await waitFor(() => expect(saveSelfAssessment).toHaveBeenCalledWith("t1", "technical", 4));
    expect(technical.querySelector('[aria-pressed="true"]')).not.toBeNull();
  });

  it("says nobody else sees it", () => {
    render(<SelfRatingCard termId="t1" termName="T" ageGroup="U11" initial={{ mental: 2 }} />);
    expect(screen.getByText(/Only you and your coach can see this/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mental" }).querySelector('[aria-pressed="true"]')).toHaveAttribute("aria-label", "Getting there");
  });

  it("shows numbers for older players and faces for the youngest", () => {
    const { container, rerender } = render(<SelfRatingCard termId="t1" termName="T" ageGroup="U15" initial={{}} />);
    expect(container.querySelector("svg.lucide-frown")).toBeNull();
    rerender(<SelfRatingCard termId="t1" termName="T" ageGroup="U11" initial={{}} />);
    expect(container.querySelector("svg.lucide-frown")).not.toBeNull();
  });
});

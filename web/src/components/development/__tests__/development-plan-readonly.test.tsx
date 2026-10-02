import { render, screen } from "@testing-library/react";
import { DevelopmentPlanReadonly } from "../development-plan-readonly";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";

const plan: PlayerSafeDevelopmentPlan = {
  focusAreas: [{ category: "technical", area: "First touch", why: "it unlocks everything else" }],
  actions: [{ what: "Wall passes", how: "Ten minutes after school", timesPerWeek: 3, measure: "20 in a row", milestoneTemplateId: null }],
  reviewDate: "2026-11-15",
  playerNote: "You are improving every week.",
};

describe("DevelopmentPlanReadonly", () => {
  it("shows the note, focus, actions and who approved it", () => {
    render(<DevelopmentPlanReadonly plan={plan} approvedByName="Coach Sphe" audience="player" />);
    expect(screen.getByText("You are improving every week.")).toBeInTheDocument();
    expect(screen.getByText(/Technical: First touch/)).toBeInTheDocument();
    expect(screen.getByText(/Wall passes/)).toBeInTheDocument();
    expect(screen.getByText(/3x a week/)).toBeInTheDocument();
    expect(screen.getByText(/Approved by Coach Sphe/)).toBeInTheDocument();
  });

  it("is read-only: no buttons or inputs", () => {
    render(<DevelopmentPlanReadonly plan={plan} approvedByName={null} audience="parent" childName="Sipho" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/Approved by your coach/)).toBeInTheDocument();
    expect(screen.getByText(/Sipho is working on/)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { HomeChallengeCard } from "../home-challenge-card";

const challenge = {
  action: { what: "Wall passes", how: "Ten minutes", timesPerWeek: 3, measure: "20 in a row", milestoneTemplateId: null },
};

it("shows the drill and how often, with no focus-area label", () => {
  render(<HomeChallengeCard challenge={challenge} audience="player" />);
  expect(screen.getByText("Wall passes")).toBeInTheDocument();
  expect(screen.getByText(/3x this week/)).toBeInTheDocument();
  expect(screen.queryByText(/Part of the work on/)).not.toBeInTheDocument();
});

it("names the child for a parent", () => {
  render(<HomeChallengeCard challenge={challenge} audience="parent" childName="Sipho" />);
  expect(screen.getByText(/home challenge for Sipho/i)).toBeInTheDocument();
});

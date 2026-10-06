/**
 * The director cards shared by the admin and coach Today pages. What is tested:
 * a card shows only when it is picked and has data, and the coverage row links
 * to the admin screen for an admin but to nowhere for a coach, who cannot open it.
 */
import { render, screen } from "@testing-library/react";
import { DirectorCardList } from "../director-cards";
import type { DirectorCards } from "@/lib/director-data";

const data: DirectorCards = {
  objectives: null,
  fixtures: null,
  sessions: null,
  coverage: [{ ageGroup: "U13", percent: 40, items: 20, notTouched: 12 }],
};

it("links a coverage row to the admin screen by default", () => {
  render(<DirectorCardList cards={["coverage"]} data={data} />);
  expect(screen.getByRole("link", { name: /U13: 40% trained/ })).toHaveAttribute("href", "/dashboard/admin/academy?tab=coverage");
});

it("shows a coverage row with no link for a coach", () => {
  render(<DirectorCardList cards={["coverage"]} data={data} coverageHref={null} />);
  expect(screen.getByText(/U13: 40% trained/)).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("shows nothing for a card that was not picked", () => {
  render(<DirectorCardList cards={["sessions"]} data={data} />);
  expect(screen.queryByText(/trained/)).not.toBeInTheDocument();
});

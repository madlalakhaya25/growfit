/**
 * The coverage view. What is tested: the window is shown, "Not touched" lists
 * what was missed with its heading, trained items show count and last day,
 * objectives are mentioned, and an empty curriculum says to write it first.
 */
import { render, screen } from "@testing-library/react";
import { CoverageView } from "../coverage-view";
import { computeCoverage } from "@/lib/curriculum-coverage";
import type { CurriculumItem } from "@/lib/curriculum";

const item = (id: string, title: string, category: CurriculumItem["category"] = "technical"): CurriculumItem => ({
  id, ageGroup: "U13", category, title, description: null, sortOrder: 0, active: true,
});
const span = { from: "2026-07-21", to: "2026-10-02" };

it("shows what was trained, what was not, and the window", () => {
  const groups = computeCoverage(
    [item("a", "First touch"), item("b", "Crossing"), item("c", "Bounce back", "mental")],
    [
      { itemId: "a", linkType: "session", linkId: "s1" },
      { itemId: "a", linkType: "session", linkId: "s2" },
      { itemId: "a", linkType: "objective", linkId: "o1" },
    ],
    [{ id: "s1", date: "2026-08-05" }, { id: "s2", date: "2026-09-10" }],
    span,
  );
  render(<CoverageView groups={groups} span={span} />);
  expect(screen.getByText("Counted from 2026-07-21 to 2026-10-02.")).toBeInTheDocument();
  expect(screen.getByText("33% trained")).toBeInTheDocument();
  expect(screen.getByText("Technical: Crossing")).toBeInTheDocument();
  expect(screen.getByText("Mental: Bounce back")).toBeInTheDocument();
  expect(screen.queryByText("Technical: First touch")).not.toBeInTheDocument();
  expect(screen.getByText("2 sessions, last 2026-09-10 · 1 objective")).toBeInTheDocument();
});

it("says so when everything has been trained", () => {
  const groups = computeCoverage([item("a", "First touch")], [{ itemId: "a", linkType: "session", linkId: "s1" }], [{ id: "s1", date: "2026-08-05" }], span);
  render(<CoverageView groups={groups} span={span} />);
  expect(screen.getByText("Every item has been trained.")).toBeInTheDocument();
  expect(screen.getByText("100% trained")).toBeInTheDocument();
});

it("asks for the curriculum first when there is none", () => {
  render(<CoverageView groups={[]} span={span} />);
  expect(screen.getByText(/Write the curriculum first/)).toBeInTheDocument();
});

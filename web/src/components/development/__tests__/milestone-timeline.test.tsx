import { render, screen, within } from "@testing-library/react";
import { MilestoneTimeline } from "../milestone-timeline";
import {
  MILESTONES_LOAD_ERROR,
  buildDevelopmentSnapshot,
  type MilestoneCompletion,
  type MilestoneTemplate,
} from "@/lib/development-data";

const NOW = new Date("2026-10-10T10:00:00Z");
const tpl = (id: string, category: MilestoneTemplate["category"]): MilestoneTemplate => ({
  id, title: `Title ${id}`, description: null, category, position: null, age_group: null, sort_order: 0,
});
const done = (templateId: string, season: string, completedAt: string | null, extra: Partial<MilestoneCompletion> = {}): MilestoneCompletion => ({
  templateId, season, completedAt, note: null, completedByName: null, ...extra,
});
const snap = (templates: MilestoneTemplate[], completions: MilestoneCompletion[]) =>
  buildDevelopmentSnapshot({ templates, completions, now: NOW });

describe("MilestoneTimeline", () => {
  it("a failed load is an error with a retry, not an empty history", () => {
    const s = buildDevelopmentSnapshot({ templates: [], completions: [], loadError: MILESTONES_LOAD_ERROR, now: NOW });
    render(<MilestoneTimeline snapshot={s} audience="coach" />);
    expect(screen.getByRole("alert")).toHaveTextContent(MILESTONES_LOAD_ERROR);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("with nothing completed in any season, says so once", () => {
    render(<MilestoneTimeline snapshot={snap([tpl("a", "technical")], [])} audience="player" />);
    expect(screen.getByText(/Nothing signed off yet\. Milestones appear here/)).toBeInTheDocument();
  });

  it("lists seasons newest first and milestones newest first within a season", () => {
    render(
      <MilestoneTimeline
        snapshot={snap(
          [tpl("a", "technical"), tpl("b", "tactical"), tpl("c", "mental")],
          [done("a", "2025", "2025-03-01T00:00:00Z"), done("b", "2026", "2026-02-01T00:00:00Z"), done("c", "2026", "2026-09-01T00:00:00Z")]
        )}
        audience="coach"
      />
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["2026 season", "2025 season"]);
    const current = screen.getByRole("region", { name: "2026 season" });
    const titles = within(current).getAllByText(/^Title /).map((e) => e.textContent);
    expect(titles).toEqual(["Title c", "Title b"]);
  });

  it("shows the coach's name on the coach surface and 'your coach' to a player — never blank", () => {
    const s = snap([tpl("a", "technical")], [done("a", "2026", "2026-09-01T00:00:00Z", { completedByName: "Sphe Mlotshwa" })]);
    const { rerender } = render(<MilestoneTimeline snapshot={s} audience="coach" />);
    expect(screen.getByText(/Sphe Mlotshwa/)).toBeInTheDocument();

    const hidden = snap([tpl("a", "technical")], [done("a", "2026", "2026-09-01T00:00:00Z")]);
    rerender(<MilestoneTimeline snapshot={hidden} audience="player" />);
    expect(screen.getByText(/your coach/)).toBeInTheDocument();
    rerender(<MilestoneTimeline snapshot={hidden} audience="parent" />);
    expect(screen.getByText(/the coaches/)).toBeInTheDocument();
  });

  it("shows the coach's note in full, including a long one", () => {
    const note = "Showed real composure under pressure against a much bigger side and kept the ball moving the whole half.";
    render(<MilestoneTimeline snapshot={snap([tpl("a", "mental")], [done("a", "2026", "2026-09-01T00:00:00Z", { note })])} audience="player" />);
    expect(screen.getByText(new RegExp(note.slice(0, 40)))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(note.slice(-30)))).toBeInTheDocument();
  });

  it("the current season shows done/total per corner; a past season shows counts only", () => {
    render(
      <MilestoneTimeline
        snapshot={snap(
          [tpl("a", "technical"), tpl("b", "technical"), tpl("c", "mental")],
          [done("a", "2026", "2026-09-01T00:00:00Z"), done("c", "2025", "2025-04-01T00:00:00Z")]
        )}
        audience="coach"
      />
    );
    const current = screen.getByRole("region", { name: "2026 season" });
    expect(within(current).getByText("1/2")).toBeInTheDocument();
    const past = screen.getByRole("region", { name: "2025 season" });
    expect(within(past).getByText("Mental 1")).toBeInTheDocument();
    // no denominators for a past season, which would be measured against today's pathway
    expect(within(past).queryByText(/\d\/\d/)).not.toBeInTheDocument();
  });

  it("shows the current season's empty state when only past seasons have history", () => {
    render(<MilestoneTimeline snapshot={snap([tpl("a", "technical")], [done("a", "2025", "2025-04-01T00:00:00Z")])} audience="coach" />);
    expect(within(screen.getByRole("region", { name: "2026 season" })).getByText("Nothing signed off yet this season.")).toBeInTheDocument();
  });

  it("a completion whose milestone is gone renders neutrally rather than crashing or being dropped", () => {
    render(<MilestoneTimeline snapshot={snap([], [done("gone", "2026", "2026-09-01T00:00:00Z")])} audience="coach" />);
    expect(screen.getByText("A milestone no longer in the pathway")).toBeInTheDocument();
  });

  it("a missing timestamp shows no date rather than 'Invalid Date'", () => {
    render(<MilestoneTimeline snapshot={snap([tpl("a", "technical")], [done("a", "2026", null)])} audience="coach" />);
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
    expect(screen.getByText("a coach")).toBeInTheDocument();
  });
});

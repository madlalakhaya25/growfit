import { render, screen } from "@testing-library/react";

// The interactive card imports a Server Action, which pulls in next/cache and
// the request-bound Supabase client at module load -- neither exists under
// jsdom. Stubbing the action module is a build-graph workaround; the toggle is
// never invoked by these render tests.
jest.mock("@/app/actions/development", () => ({ toggleMilestoneCompletion: jest.fn() }));

import { DevelopmentOverview } from "../development-overview";
import {
  MILESTONES_LOAD_ERROR,
  MILESTONES_NO_ACADEMY,
  buildDevelopmentSnapshot,
  type MilestoneCompletion,
  type MilestoneTemplate,
} from "@/lib/development-data";

const NOW = new Date("2026-10-10T10:00:00Z");
const tpl = (id: string, category: MilestoneTemplate["category"], extra: Partial<MilestoneTemplate> = {}): MilestoneTemplate => ({
  id, title: `Title ${id}`, description: `Desc ${id}`, category, position: null, age_group: null, sort_order: 0, ...extra,
});
const done = (templateId: string, note: string | null = null): MilestoneCompletion => ({
  templateId, season: "2026", completedAt: "2026-09-01T00:00:00Z", note, completedByName: null,
});

const snapshot = (templates: MilestoneTemplate[], completions: MilestoneCompletion[] = []) =>
  buildDevelopmentSnapshot({ templates, completions, now: NOW });

/** A StatTile's value: the <p> that follows the label's wrapper. */
const tileValue = (label: string) => screen.getByText(label).closest("div")!.nextElementSibling as HTMLElement;

describe("DevelopmentOverview", () => {
  it("a failed load is an error with a retry — never an empty pathway", () => {
    const s = buildDevelopmentSnapshot({ templates: [], completions: [], loadError: MILESTONES_LOAD_ERROR, now: NOW });
    render(<DevelopmentOverview snapshot={s} audience="coach" />);
    expect(screen.getByRole("alert")).toHaveTextContent(MILESTONES_LOAD_ERROR);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/no milestones/i)).not.toBeInTheDocument();
  });

  it("an unlinked academy says so, distinctly from 'no milestones'", () => {
    const s = buildDevelopmentSnapshot({ templates: [], completions: [], loadError: MILESTONES_NO_ACADEMY, now: NOW });
    render(<DevelopmentOverview snapshot={s} audience="parent" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't linked to an academy/);
  });

  it("a genuinely empty pathway shows an audience-appropriate empty state", () => {
    const { rerender } = render(<DevelopmentOverview snapshot={snapshot([])} audience="player" />);
    expect(screen.getByText(/Your coach adds these/)).toBeInTheDocument();
    rerender(<DevelopmentOverview snapshot={snapshot([])} audience="coach" />);
    expect(screen.getByText(/Development Pathways/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("summarises this season: done, to go, and a percentage", () => {
    render(
      <DevelopmentOverview
        snapshot={snapshot([tpl("a", "technical"), tpl("b", "technical"), tpl("c", "mental"), tpl("d", "mental")], [done("a"), done("c")])}
        audience="player"
      />
    );
    expect(tileValue("Done")).toHaveTextContent("2");
    expect(tileValue("To go")).toHaveTextContent("2");
    expect(tileValue("Complete")).toHaveTextContent("50%");
  });

  it("draws a bar per category that has milestones, in order, and none for the rest", () => {
    render(<DevelopmentOverview snapshot={snapshot([tpl("a", "mental"), tpl("b", "technical")], [done("a")])} audience="player" />);
    const meters = screen.getAllByRole("meter");
    expect(meters.map((m) => m.getAttribute("aria-label"))).toEqual(["Technical: 0 out of 100", "Mental: 100 out of 100"]);
    // the bar wears the category's own token, not a completion band
    expect((meters[1].firstElementChild as HTMLElement).style.backgroundColor).toBe("var(--color-dev-mental)");
  });

  it("read-only: lists milestones with their state and any note, and offers no toggle", () => {
    render(
      <DevelopmentOverview
        snapshot={snapshot([tpl("a", "technical"), tpl("b", "technical")], [done("a", "Great first touch")])}
        audience="player"
      />
    );
    expect(screen.queryByRole("button", { name: /mark (in)?complete/i })).not.toBeInTheDocument();
    expect(screen.getByText("Title a")).toBeInTheDocument();
    expect(screen.getByText(/complete/, { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText(/Great first touch/)).toBeInTheDocument();
    // a note only shows on a completed milestone
    expect(screen.getAllByText(/Great first touch/)).toHaveLength(1);
  });

  it("a completed read-only milestone has the category fill and a visible tick — not two bg classes", () => {
    const { container } = render(<DevelopmentOverview snapshot={snapshot([tpl("a", "physical")], [done("a")])} audience="player" />);
    const filled = container.querySelector(".bg-dev-physical.rounded-full");
    expect(filled).not.toBeNull();
    expect(filled!.className.match(/\bbg-/g)).toHaveLength(1);
    expect(filled!.querySelector("svg")?.getAttribute("class")).toMatch(/text-background/);
  });

  it("interactive (coach): each milestone is a toggle reflecting this season's state", () => {
    render(
      <DevelopmentOverview
        snapshot={snapshot([tpl("a", "tactical"), tpl("b", "tactical")], [done("a")])}
        audience="coach"
        playerId="p1"
      />
    );
    expect(screen.getAllByRole("button", { name: "Mark incomplete" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Mark complete" })).toHaveLength(1);
  });

  it("a completion from a previous season does not count as done now", () => {
    const old: MilestoneCompletion = { ...done("a"), season: "2025" };
    render(<DevelopmentOverview snapshot={snapshot([tpl("a", "technical")], [old])} audience="coach" playerId="p1" />);
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument();
    expect(tileValue("Done")).toHaveTextContent("0");
    expect(tileValue("To go")).toHaveTextContent("1");
  });

  it("each category group is labelled with its name and an icon, not colour alone", () => {
    const { container } = render(<DevelopmentOverview snapshot={snapshot([tpl("a", "leadership")])} audience="player" />);
    const chip = container.querySelector(".bg-dev-leadership\\/10");
    expect(chip).toHaveTextContent("Leadership");
    expect(chip!.querySelector("svg")).not.toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { WeekBriefCard } from "../week-brief-card";

const noFocus = { rows: [], planned: 0, squadSize: 18 };
const focus = {
  rows: [
    { category: "technical" as const, label: "Technical", players: 7, areas: ["First touch"] },
    { category: "mental" as const, label: "Mental", players: 4, areas: [] },
    { category: "tactical" as const, label: "Tactical", players: 2, areas: ["Pressing"] },
  ],
  planned: 12,
  squadSize: 18,
};

describe("WeekBriefCard", () => {
  it("shows the match and the training, with no gap warning when training is planned", () => {
    render(
      <WeekBriefCard
        teamId="t1"
        brief={{
          sessions: [{ id: "s1", title: "Wed", session_date: "2026-10-07T15:00:00Z" }],
          fixture: { id: "f1", opponent: "Rovers", fixture_date: "2026-10-11T08:00:00Z" },
          trainingGap: false,
        }}
        focus={noFocus}
      />
    );
    expect(screen.getByText("Rovers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Oct/ })).toHaveAttribute("href", "/dashboard/coach/training/s1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns when a match is coming and no training is planned before it", () => {
    render(
      <WeekBriefCard
        teamId="t1"
        brief={{ sessions: [], fixture: { id: "f1", opponent: "Rovers", fixture_date: "2026-10-11T08:00:00Z" }, trainingGap: true }}
        focus={noFocus}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("no training is planned before it");
    expect(screen.getByText("No training planned in the next seven days.")).toBeInTheDocument();
  });

  it("offers a one-tap session for the top two squad focuses only", () => {
    render(<WeekBriefCard teamId="t1" brief={{ sessions: [], fixture: null, trainingGap: false }} focus={focus} />);
    expect(screen.getByText("7 of 18 are working on Technical: First touch.")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Plan a session/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/dashboard/coach/training/new?team=t1&focus=First%20touch");
    expect(links[1]).toHaveAttribute("href", "/dashboard/coach/training/new?team=t1&focus=Mental");
    expect(screen.queryByText(/Tactical/)).toBeNull();
  });

  it("shows nothing about focus when no plans are approved", () => {
    render(<WeekBriefCard teamId="t1" brief={{ sessions: [], fixture: null, trainingGap: false }} focus={noFocus} />);
    expect(screen.queryByText(/working on/)).toBeNull();
  });
});

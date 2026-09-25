import { render, screen } from "@testing-library/react";
import { FixtureTicket } from "@/components/ui/fixture-ticket";

// Regression test for a real bug caught by the PR2 render check: `cn()`
// (tailwind-merge) treats any two `bg-*` classes as the same conflicting
// "background-color" group and silently drops one of them. FixtureTicket
// combines `bg-ink` (the card's fill) with the `pitch-lines` texture
// utility — this only stays safe because `pitch-lines` doesn't start with
// `bg-`. Renaming it back to `bg-pitch-lines` reintroduces the bug (the
// card loses its background colour and text becomes unreadable against
// the page). See globals.css's comment on `.pitch-lines` for the fuller
// story.
describe("FixtureTicket", () => {
  it("keeps its bg-ink fill alongside the pitch-lines texture utility", () => {
    render(
      <FixtureTicket
        weekday="Sun"
        day="12"
        month="Oct"
        time="09:00"
        opponent="Durban Rovers"
        isHome
      />
    );
    const ticket = screen.getByText("vs Durban Rovers").closest("div.pitch-lines");
    expect(ticket).toHaveClass("bg-ink");
    expect(ticket).toHaveClass("pitch-lines");
  });

  it("shows 'vs' for a home fixture and '@' for an away fixture", () => {
    const { rerender } = render(
      <FixtureTicket weekday="Sun" day="12" month="Oct" time="09:00" opponent="Durban Rovers" isHome />
    );
    expect(screen.getByText("vs Durban Rovers")).toBeInTheDocument();

    rerender(
      <FixtureTicket weekday="Sun" day="12" month="Oct" time="09:00" opponent="Durban Rovers" isHome={false} />
    );
    expect(screen.getByText("@ Durban Rovers")).toBeInTheDocument();
  });
});

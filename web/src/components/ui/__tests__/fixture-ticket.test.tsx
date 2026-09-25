import { render, screen } from "@testing-library/react";
import { FixtureTicket } from "@/components/ui/fixture-ticket";

// Regression test: FixtureTicket used to be a dark "ink" band; it's the
// plain Card surface now (see the component's own note on why), but it
// still combines `bg-card` with several other classes, and `cn()`
// (tailwind-merge) treats any two `bg-*` classes as the same conflicting
// "background-color" group and silently drops one of them. This just
// pins that the card actually keeps its background colour.
describe("FixtureTicket", () => {
  it("keeps its card background", () => {
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
    const ticket = screen.getByText("vs Durban Rovers").closest("div.bg-card");
    expect(ticket).toHaveClass("bg-card");
    expect(ticket).toHaveClass("border-border");
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

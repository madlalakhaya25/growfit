import { render, screen } from "@testing-library/react";
import { FixtureTicket } from "@/components/ui/fixture-ticket";

// Regression test: the fixture ticket should sit on the page's standard
// surface styling, not a pitch-textured ink banner. This keeps the card in
// sync with the log-result panel in both light and dark mode.
describe("FixtureTicket", () => {
  it("uses the standard panel styling without pitch lines", () => {
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
    const ticket = screen.getByText("vs Durban Rovers").closest("div");
    expect(ticket).toHaveClass("bg-card");
    expect(ticket).toHaveClass("border");
    expect(ticket).not.toHaveClass("pitch-lines");
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

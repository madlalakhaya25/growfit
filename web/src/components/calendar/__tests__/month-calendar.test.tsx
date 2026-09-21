import { render, screen } from "@testing-library/react";
import { MonthCalendar, type CalendarEvent } from "@/components/calendar/month-calendar";

describe("MonthCalendar", () => {
  it("renders one day cell per day in the month", () => {
    // September 2026 has 30 days.
    render(<MonthCalendar year={2026} month={9} events={[]} basePath="/x" />);
    for (const day of [1, 15, 30]) {
      expect(screen.getByText(String(day))).toBeInTheDocument();
    }
  });

  it("places an event under the correct day and not an adjacent one", () => {
    const events: CalendarEvent[] = [
      { id: "1", date: "2026-09-13T15:00:00.000Z", title: "vs Rivals FC", kind: "fixture" },
    ];
    render(<MonthCalendar year={2026} month={9} events={events} basePath="/x" />);
    expect(screen.getByText("vs Rivals FC")).toBeInTheDocument();
  });

  it("ignores an event from a different month", () => {
    const events: CalendarEvent[] = [
      { id: "1", date: "2026-10-01T15:00:00.000Z", title: "October fixture", kind: "fixture" },
    ];
    render(<MonthCalendar year={2026} month={9} events={events} basePath="/x" />);
    expect(screen.queryByText("October fixture")).not.toBeInTheDocument();
  });

  it("shows an overflow count past the third event on one day", () => {
    const events: CalendarEvent[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      date: "2026-09-05T09:00:00.000Z",
      title: `Session ${i}`,
      kind: "training" as const,
    }));
    render(<MonthCalendar year={2026} month={9} events={events} basePath="/x" />);
    expect(screen.getByText("Session 0")).toBeInTheDocument();
    expect(screen.getByText("Session 2")).toBeInTheDocument();
    expect(screen.queryByText("Session 3")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("builds prev/next month links preserving extra query params", () => {
    render(
      <MonthCalendar
        year={2026}
        month={9}
        events={[]}
        basePath="/dashboard/parent/fixtures"
        extraQuery={{ view: "calendar" }}
      />
    );
    const prev = screen.getByLabelText("Previous month");
    const next = screen.getByLabelText("Next month");
    expect(prev).toHaveAttribute(
      "href",
      "/dashboard/parent/fixtures?view=calendar&month=2026-08"
    );
    expect(next).toHaveAttribute(
      "href",
      "/dashboard/parent/fixtures?view=calendar&month=2026-10"
    );
  });

  it("wraps to next January when navigating forward from December", () => {
    render(<MonthCalendar year={2026} month={12} events={[]} basePath="/x" />);
    expect(screen.getByLabelText("Next month")).toHaveAttribute("href", "/x?month=2027-01");
  });

  it("wraps to previous December when navigating back from January", () => {
    render(<MonthCalendar year={2026} month={1} events={[]} basePath="/x" />);
    expect(screen.getByLabelText("Previous month")).toHaveAttribute("href", "/x?month=2025-12");
  });

  it("links an event to its href when given", () => {
    const events: CalendarEvent[] = [
      { id: "1", date: "2026-09-13T15:00:00.000Z", title: "vs Rivals FC", kind: "fixture", href: "/dashboard/coach/fixtures/1" },
    ];
    render(<MonthCalendar year={2026} month={9} events={events} basePath="/x" />);
    expect(screen.getByRole("link", { name: /vs Rivals FC/ })).toHaveAttribute(
      "href",
      "/dashboard/coach/fixtures/1"
    );
  });
});

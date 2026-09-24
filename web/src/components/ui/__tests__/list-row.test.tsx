import { render, screen, fireEvent } from "@testing-library/react";
import { ListRow } from "@/components/ui/list-row";

describe("ListRow", () => {
  it("renders as a link when given href", () => {
    render(<ListRow title="Sipho Ndlovu" href="/dashboard/coach/squad/1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/coach/squad/1");
  });

  it("renders as a button when given only onClick", () => {
    const onClick = jest.fn();
    render(<ListRow title="Schedule a fixture" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // A row that both navigates and closes its enclosing Sheet
  // (quick-actions-sheet.tsx) needs both props to fire together — the
  // href branch used to silently drop onClick.
  it("still calls onClick when href is also given", () => {
    const onClick = jest.fn();
    render(<ListRow title="Schedule a fixture" href="/dashboard/coach/fixtures/new" onClick={onClick} />);
    fireEvent.click(screen.getByRole("link"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a plain row with neither href nor onClick", () => {
    render(<ListRow title="Static row" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Regression: a fixture row with a score plus two badges in `trailing`
  // squeezed the title/subtitle column down to almost nothing on a phone
  // (390px), truncating a venue name that had plenty of room to show in
  // full. jsdom can't verify the actual wrap, but it can guard the two
  // classes that make it possible from being quietly removed: flex-wrap
  // on the row (so a full trailing column can drop to its own line) and a
  // width floor on the title/subtitle column (so it cedes that line
  // before shrinking toward zero).
  it("keeps the classes that let a crowded trailing column wrap onto its own line", () => {
    render(<ListRow title="vs Durban Rovers" trailing="2 – 1" href="#" />);
    const row = screen.getByRole("link");
    expect(row).toHaveClass("flex-wrap");
    expect(row.querySelector(".min-w-32")).not.toBeNull();
    expect(row.querySelector(".flex-wrap.justify-end")).not.toBeNull();
  });
});

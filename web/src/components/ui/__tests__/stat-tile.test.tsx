import { render, screen } from "@testing-library/react";
import { StatTile } from "@/components/ui/stat-tile";

describe("StatTile", () => {
  it("renders a real zero as 0, not as a failure", () => {
    render(<StatTile label="Active players" value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  // Regression: a failed count coerced to 0 by its caller (`count ?? 0`)
  // used to render identically to a genuine "0 active players" -- a real,
  // alarming fact and "couldn't load" looked the same. `null` is now the
  // caller's signal for the latter.
  it("renders a failed count (null) as —, not as 0", () => {
    render(<StatTile label="Active players" value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders a non-numeric value as given", () => {
    render(<StatTile label="Attendance" value="82%" />);
    expect(screen.getByText("82%")).toBeInTheDocument();
  });
});

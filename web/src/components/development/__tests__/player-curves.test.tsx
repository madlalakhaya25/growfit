jest.mock("recharts", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Pass, LineChart: Pass, Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null };
});
import { render, screen } from "@testing-library/react";
import { PlayerCurves } from "../player-curves";
import { buildCurves } from "@/lib/curves";

const NOW = new Date("2026-10-15T10:00:00Z");

describe("PlayerCurves", () => {
  it("shows the readings under the charts when there is enough to say", () => {
    const curves = buildCurves({
      ratings: [{ date: "2026-05-10", rating: 2 }, { date: "2026-10-10", rating: 5 }],
      attendance: [], milestones: [],
    }, NOW);
    render(<PlayerCurves curves={curves} />);
    expect(screen.getByText(/Match ratings are up, from 2 to 5/)).toBeInTheDocument();
  });

  it("says there is not enough yet instead of drawing an empty chart", () => {
    render(<PlayerCurves curves={buildCurves({ ratings: [], attendance: [], milestones: [] }, NOW)} />);
    expect(screen.getAllByText("Not enough yet")).toHaveLength(3);
    expect(screen.queryByRole("list")).toBeNull();
  });
});

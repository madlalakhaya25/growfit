jest.mock("@/app/actions/term-plan", () => ({ addPlannedSession: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TermPlanView } from "../term-plan-view";
import { addPlannedSession } from "@/app/actions/term-plan";
import { buildTermPlan } from "@/lib/term-plan";

const weeks = buildTermPlan({ term: { starts_on: "2026-10-13", ends_on: "2026-10-30" }, ageGroup: "U13", fixtures: [{ date: "2026-10-18", opponent: "Hawks" }] });

beforeEach(() => jest.clearAllMocks());

describe("TermPlanView", () => {
  it("shows each week with its load, corner and match", () => {
    render(<TermPlanView teamId="t1" weeks={weeks} sessionDates={[]} />);
    expect(screen.getByText(/Week 1/)).toBeInTheDocument();
    expect(screen.getByText(/Settle in · Technical/)).toBeInTheDocument();
    expect(screen.getByText(/Match: Hawks/)).toBeInTheDocument();
  });

  it("adds a session and then shows it as on the list", async () => {
    (addPlannedSession as jest.Mock).mockResolvedValue({ success: true });
    render(<TermPlanView teamId="t1" weeks={weeks} sessionDates={[]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Add to training" })[0]);
    await waitFor(() => expect(addPlannedSession).toHaveBeenCalledWith(expect.objectContaining({ teamId: "t1", date: "2026-10-14" })));
    await waitFor(() => expect(screen.getAllByText("On your training list")).toHaveLength(1));
  });

  it("marks days the team already trains and offers no second add", () => {
    render(<TermPlanView teamId="t1" weeks={weeks} sessionDates={["2026-10-14"]} />);
    expect(screen.getAllByText("On your training list")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Add to training" }).length).toBe(weeks.flatMap((w) => w.sessions).length - 1);
  });
});

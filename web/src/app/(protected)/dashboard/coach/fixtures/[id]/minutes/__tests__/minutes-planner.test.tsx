import { act, fireEvent, render, screen } from "@testing-library/react";

const mockSave = jest.fn();
jest.mock("@/app/actions/match-minutes", () => ({ saveMatchMinutes: (...a: unknown[]) => mockSave(...a) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { MinutesPlanner, type PlannerPlayer } from "../minutes-planner";
import { storageKey } from "@/lib/playing-time-live";

const players: PlannerPlayer[] = ["Ayanda", "Bongani", "Lwazi", "Sipho", "Thabo", "Zola", "Musa", "Nandi", "Owen"].map(
  (name, i) => ({ id: `p${i + 1}`, name, isKeeper: i === 0, unavailable: false }),
);

async function renderPlanner() {
  render(
    <MinutesPlanner
      fixtureId="f1"
      players={players}
      defaultSelected={players.map((p) => p.id)}
      defaultFormat={{ halves: 2, halfMinutes: 25, onPitch: 7 }}
    />,
  );
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
});

describe("MinutesPlanner", () => {
  it("shows a fair plan and starts a match that survives a reload", async () => {
    await renderPlanner();
    expect(screen.getByText(/Ayanda stays in goal for all 50/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start match day/ }));
    expect(screen.getByLabelText("Match clock")).toHaveTextContent("0:00");
    const stored = JSON.parse(window.localStorage.getItem(storageKey("f1")) ?? "null");
    expect(stored.onPitch).toHaveLength(7);
    expect(stored.config.keeperId).toBe("p1");
  });

  it("picks up a stored match instead of the set-up screen", async () => {
    await renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /Start match day/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start clock/ }));
    // Unmount and render fresh, as a reload would.
    document.body.innerHTML = "";
    await renderPlanner();
    expect(screen.queryByRole("button", { name: /Start match day/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument();
    expect(screen.getByText(/Next change in/)).toBeInTheDocument();
  });
});

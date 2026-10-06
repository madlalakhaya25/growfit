/**
 * The weekly-focus step of the result form. What is tested: tap-to-fill
 * problems follow the chosen phase and the team's age, a tapped preset sends
 * its key, and the coach's own words (or an edited preset) send no key.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockLog = jest.fn();
jest.mock("@/app/actions/fixtures", () => ({ logMatch: (...a: unknown[]) => mockLog(...a) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }) }));
jest.mock("@/app/actions/copilot", () => ({ thinkItThrough: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { LogResultForm } from "../log-result-form";

const LONG_BALLS = "We play too many long balls and lose the ball.";
const DEEP_BLOCK = "We cannot break a team that sits deep.";

function setup(ageGroup: string) {
  mockLog.mockResolvedValue({ success: true });
  render(<LogResultForm fixtureId="f1" squad={[]} isHome opponent="Rovers" ageGroup={ageGroup} />);
  fireEvent.change(screen.getByLabelText(/Phase of play/), { target: { value: "in_possession" } });
}

async function submitAndGetObjective() {
  fireEvent.submit(screen.getByLabelText("The problem").closest("form")!);
  await waitFor(() => expect(mockLog).toHaveBeenCalled());
  return (mockLog.mock.calls[0][0] as { objective?: { problem: string; problemKey: string | null; phase: string } }).objective;
}

beforeEach(() => jest.clearAllMocks());

it("offers the shared problems to U11 and not the U13 ones", () => {
  setup("U11");
  expect(screen.getByRole("button", { name: LONG_BALLS })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: DEEP_BLOCK })).not.toBeInTheDocument();
});

it("adds the U13 problems for an older team", () => {
  setup("U13");
  expect(screen.getByRole("button", { name: DEEP_BLOCK })).toBeInTheDocument();
});

it("fills the problem on tap and sends its key", async () => {
  setup("U13");
  fireEvent.click(screen.getByRole("button", { name: LONG_BALLS }));
  expect(screen.getByLabelText("The problem")).toHaveValue(LONG_BALLS);
  expect(await submitAndGetObjective()).toEqual({ phase: "in_possession", problem: LONG_BALLS, problemKey: "ip-long-balls" });
});

it("sends no key for the coach's own words or an edited preset", async () => {
  setup("U13");
  fireEvent.click(screen.getByRole("button", { name: LONG_BALLS }));
  fireEvent.change(screen.getByLabelText("The problem"), { target: { value: "We play too many long balls" } });
  expect((await submitAndGetObjective())?.problemKey).toBeNull();
});

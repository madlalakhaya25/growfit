/**
 * The register keeps taps on the phone and saves them together. What is
 * tested: several taps become one save after the delay, "mark remaining
 * present" saves at once without touching rows already marked, and a refused
 * save puts the rows back.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";

const mockSave = jest.fn();
jest.mock("@/app/actions/attendance", () => ({
  saveTrainingRegister: (...args: unknown[]) => mockSave(...args),
  markTrainingAttendance: jest.fn(),
  markMatchAttendance: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }) }));
jest.mock("@/lib/offline-attendance-queue", () => ({
  enqueueAttendanceWrite: jest.fn(),
  listQueuedAttendanceWrites: async () => [],
  removeQueuedAttendanceWrite: jest.fn(),
}));

import { TrainingAttendanceForm, REGISTER_SAVE_DELAY_MS } from "../training-attendance-form";

const players = [
  { id: "p1", full_name: "Ayanda" },
  { id: "p2", full_name: "Bongani" },
  { id: "p3", full_name: "Lwazi" },
];

const button = (name: string, label: string) =>
  screen.getByRole("group", { name: `Attendance for ${name}` }).querySelector(`button:nth-child(${label})`) as HTMLButtonElement;
const pressed = (name: string) =>
  [...screen.getByRole("group", { name: `Attendance for ${name}` }).querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-pressed") === "true")?.textContent ?? null;

beforeEach(() => {
  jest.useFakeTimers();
  mockSave.mockReset().mockResolvedValue({ success: true });
});
afterEach(() => jest.useRealTimers());

it("saves several taps as one batch after the coach stops tapping", async () => {
  render(<TrainingAttendanceForm sessionId="s1" players={players} existing={[]} />);
  fireEvent.click(button("Ayanda", "1"));
  fireEvent.click(button("Bongani", "1"));
  fireEvent.click(button("Ayanda", "2"));
  expect(mockSave).not.toHaveBeenCalled();

  await act(async () => { jest.advanceTimersByTime(REGISTER_SAVE_DELAY_MS); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][1]).toEqual([
    { playerId: "p1", status: "late" },
    { playerId: "p2", status: "present" },
  ]);
});

it("marks only the unmarked players present, and saves straight away", async () => {
  render(<TrainingAttendanceForm sessionId="s1" players={players} existing={[{ player_id: "p2", status: "absent" }]} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mark remaining 2 present" })); });
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0][1]).toEqual([
    { playerId: "p1", status: "present" },
    { playerId: "p3", status: "present" },
  ]);
  expect(pressed("Bongani")).toMatch(/Absent/);
});

it("puts rows back when the save is refused", async () => {
  mockSave.mockResolvedValue({ error: "Session not found or access denied." });
  render(<TrainingAttendanceForm sessionId="s1" players={players} existing={[{ player_id: "p2", status: "absent" }]} />);
  fireEvent.click(button("Ayanda", "1"));
  fireEvent.click(button("Bongani", "1"));
  await act(async () => { jest.advanceTimersByTime(REGISTER_SAVE_DELAY_MS); });
  expect(pressed("Ayanda")).toBeNull();
  expect(pressed("Bongani")).toMatch(/Absent/);
});

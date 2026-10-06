/**
 * The offline notice. What is tested: nothing shows while online, it appears
 * when the browser goes offline and says what still works, and it goes away
 * when the connection returns.
 */
import { act, render, screen } from "@testing-library/react";
import { OfflineBanner } from "../offline-banner";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
  act(() => { window.dispatchEvent(new Event(value ? "online" : "offline")); });
}

afterEach(() => setOnline(true));

it("shows nothing while online", () => {
  render(<OfflineBanner />);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("appears when the connection drops and says what still works", () => {
  render(<OfflineBanner />);
  setOnline(false);
  expect(screen.getByRole("status")).toHaveTextContent(/You're offline/);
  expect(screen.getByRole("status")).toHaveTextContent(/Attendance marks will send/);
});

it("goes away when the connection returns", () => {
  render(<OfflineBanner />);
  setOnline(false);
  setOnline(true);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRead = jest.fn();
const mockApply = jest.fn();
jest.mock("@/app/actions/match-poster", () => ({
  readMatchPoster: (...a: unknown[]) => mockRead(...a),
  applyMatchPoster: (...a: unknown[]) => mockApply(...a),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { PosterImport } from "../poster-import";

const match = (over = {}) => ({
  key: "p0", homeTeam: "Rovers", awayTeam: "Stars", homeScore: 1, awayScore: 4, date: "2020-01-05", time: null,
  venue: null, ageGroup: null, usIsHome: null, fixtureId: null, fixtureStatus: null, otherAgeGroup: false, ...over,
});

async function readOne(m = match()) {
  mockRead.mockResolvedValue({ matches: [m] });
  const { container } = render(<PosterImport teamId="t1" backHref="/back" />);
  const file = new File(["x"], "p.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText(/Poster photo/), { target: { files: [file] } });
  fireEvent.submit(container.querySelector("form")!);
  await screen.findByText(/Check each match/);
}

beforeEach(() => jest.clearAllMocks());

it("won't save until the side and kick-off are filled, then re-orients the scores to our side", async () => {
  await readOne();
  const save = screen.getByRole("button", { name: /Save 1 match/ });
  expect(save).toBeDisabled();
  expect(screen.getByText("Choose home or away.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("We are"), { target: { value: "away" } });
  // Poster said Rovers 1 - 4 Stars and we are Stars (away): our 4, their 1.
  expect(screen.getByLabelText("Our score")).toHaveValue("4");
  expect(screen.getByLabelText("Their score")).toHaveValue("1");
  expect(screen.getByLabelText("Opponent")).toHaveValue("Rovers");

  fireEvent.change(screen.getByLabelText(/Kick-off/), { target: { value: "09:00" } });
  expect(save).toBeEnabled();
});

it("sends only ticked rows, with the reviewed values", async () => {
  mockApply.mockResolvedValue({ outcomes: [{ opponent: "Rovers", status: "created", resultLogged: true, note: null }] });
  await readOne();
  fireEvent.change(screen.getByLabelText("We are"), { target: { value: "away" } });
  fireEvent.change(screen.getByLabelText(/Kick-off/), { target: { value: "09:00" } });
  fireEvent.click(screen.getByRole("button", { name: /Save 1 match/ }));
  await waitFor(() => expect(mockApply).toHaveBeenCalled());
  expect(mockApply.mock.calls[0][0]).toEqual({
    teamId: "t1",
    rows: [{ fixtureId: null, opponent: "Rovers", isHome: false, date: "2020-01-05", time: "09:00", venue: null, teamScore: 4, opponentScore: 1 }],
  });
  expect(await screen.findByText("created + result")).toBeInTheDocument();
});

it("leaves rows for another squad and finished matches unticked", async () => {
  await readOne(match({ otherAgeGroup: true, ageGroup: "U15" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: /Save 0 matches/ })).toBeDisabled();
});

it("shows the reader's error", async () => {
  mockRead.mockResolvedValue({ error: "No matches were found on that poster." });
  const { container } = render(<PosterImport teamId="t1" backHref="/back" />);
  fireEvent.change(screen.getByLabelText(/Poster photo/), { target: { files: [new File(["x"], "p.png", { type: "image/png" })] } });
  fireEvent.submit(container.querySelector("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent(/No matches/);
});

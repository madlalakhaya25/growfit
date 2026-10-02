jest.mock("@/app/actions/term-review", () => ({ saveTermReview: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock("@/app/actions/coach-notes", () => ({ saveCoachNote: jest.fn(), deleteCoachNote: jest.fn(), transcribeCoachNote: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SquadReview } from "../squad-review";
import { saveTermReview } from "@/app/actions/term-review";

const players = [
  { id: "p1", name: "Ayanda", current: { technical: 3 as const }, last: {}, self: { technical: 5 as const } },
  { id: "p2", name: "Bheki", current: {}, last: { technical: 2 as const }, self: {} },
  { id: "p3", name: "Cebo", current: {}, last: {}, self: {} },
];

function view() {
  return render(<SquadReview termId="t1" termName="Term 2 2026" lastTermName="Term 1 2026" ageGroup="U13" players={players} notes={{}} notesAvailable />);
}

beforeEach(() => jest.clearAllMocks());

describe("SquadReview", () => {
  it("starts on the first child and steps with Next and Previous", () => {
    view();
    expect(screen.getByRole("heading", { name: "Ayanda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    expect(screen.getByRole("heading", { name: "Bheki" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(screen.getByRole("heading", { name: "Ayanda" })).toBeInTheDocument();
  });

  it("shows last term's band beside the area for the child on screen", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    expect(screen.getByText("Term 1 2026: Developing")).toBeInTheDocument();
  });

  it("shows what the player said, as a question for the coach", () => {
    view();
    expect(screen.getByText(/Player says: Really good\./)).toBeInTheDocument();
    expect(screen.getByText(/they feel really good, you see Secure/)).toBeInTheDocument();
  });

  it("jumps to the next unfinished child", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /Next unfinished/ }));
    expect(screen.getByRole("heading", { name: "Bheki" })).toBeInTheDocument();
  });

  it("saves a band for the child on screen and keeps it when the coach comes back", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    const technical = screen.getByRole("group", { name: "Technical band" });
    fireEvent.click(technical.querySelector("button:nth-child(3)") as HTMLElement); // legend is child 1, so this is the second band, Developing
    await waitFor(() => expect(saveTermReview).toHaveBeenCalledWith("p2", "t1", "technical", 2));
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    expect(screen.getByRole("group", { name: "Technical band" }).querySelector('[aria-pressed="true"]')).not.toBeNull();
  });
});

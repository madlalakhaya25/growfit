const mockSave = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/app/actions/coach-notes", () => ({
  saveCoachNote: (...a: unknown[]) => mockSave(...a),
  deleteCoachNote: (...a: unknown[]) => mockDelete(...a),
  transcribeCoachNote: jest.fn(),
}));
jest.mock("@/components/tactics/use-voice-capture", () => ({
  useVoiceCapture: () => ({ recording: false, seconds: 0, error: null, start: jest.fn(), stop: jest.fn() }),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CoachNotesBox } from "../coach-notes-box";

const base = { subjectType: "player" as const, subjectId: "p1", label: "Note about Ayo", placeholder: "Write here" };

beforeEach(() => jest.clearAllMocks());

describe("CoachNotesBox", () => {
  it("saves a typed note and shows it at the top", async () => {
    mockSave.mockResolvedValue({ success: true });
    render(<CoachNotesBox {...base} initialNotes={[]} available />);
    const save = screen.getByRole("button", { name: "Save note" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Note about Ayo"), { target: { value: "Ready for U15 trials" } });
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText("Ready for U15 trials")).toBeInTheDocument());
    expect(mockSave).toHaveBeenCalledWith({ subjectType: "player", subjectId: "p1", body: "Ready for U15 trials", source: "typed" });
    expect(screen.getByLabelText("Note about Ayo")).toHaveValue("");
  });

  it("keeps what was typed when saving fails", async () => {
    mockSave.mockResolvedValue({ error: "nope" });
    render(<CoachNotesBox {...base} initialNotes={[]} available />);
    fireEvent.change(screen.getByLabelText("Note about Ayo"), { target: { value: "keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(screen.getByLabelText("Note about Ayo")).toHaveValue("keep me");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("restores a note whose delete fails, and says notes are off before migration 056", async () => {
    mockDelete.mockResolvedValue({ error: "no" });
    render(
      <CoachNotesBox {...base} available={false} initialNotes={[{ id: "n1", body: "old note", source: "voice", createdAt: "2026-10-01T10:00:00Z", mine: true }]} />
    );
    expect(screen.getByText(/not switched on yet/)).toBeInTheDocument();
    expect(screen.getByText(/dictated/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(screen.getByText("old note")).toBeInTheDocument());
  });
});

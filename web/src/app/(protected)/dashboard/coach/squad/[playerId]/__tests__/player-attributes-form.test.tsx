import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockUpsert = jest.fn();
const mockRating = jest.fn();
jest.mock("@/app/actions/attributes", () => ({ upsertPlayerAttributes: (...a: unknown[]) => mockUpsert(...a) }));
jest.mock("@/app/actions/ratings", () => ({ addStandaloneRating: (...a: unknown[]) => mockRating(...a) }));

import { PlayerAttributesForm } from "../player-attributes-form";

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ success: true });
  mockRating.mockResolvedValue({ success: true });
});

describe("PlayerAttributesForm", () => {
  it("keeps the private note off the star rating, which parents read word for word", async () => {
    render(<PlayerAttributesForm playerId="p1" initial={null} position="CM" />);
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    fireEvent.change(screen.getByLabelText("Private assessment notes"), { target: { value: "Struggling at home lately" } });
    fireEvent.click(screen.getByRole("button", { name: /save assessment/i }));

    await waitFor(() => expect(mockRating).toHaveBeenCalled());
    expect(mockRating).toHaveBeenCalledWith("p1", { rating: 4 });
    expect(JSON.stringify(mockRating.mock.calls)).not.toContain("Struggling");
    expect(mockUpsert).toHaveBeenCalledWith("p1", expect.objectContaining({ notes: "Struggling at home lately" }));
  });

  it("starts from the coach's saved note, so saving again doesn't wipe it", async () => {
    render(<PlayerAttributesForm playerId="p1" initial={{ passing: 60 }} initialNotes="Left foot needs work" position="CM" />);
    expect(screen.getByLabelText("Private assessment notes")).toHaveValue("Left foot needs work");
    fireEvent.click(screen.getByRole("button", { name: /save assessment/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith("p1", expect.objectContaining({ notes: "Left foot needs work" })));
  });
});

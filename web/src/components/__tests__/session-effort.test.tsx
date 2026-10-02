jest.mock("@/app/actions/session-effort", () => ({ rateSessionEffort: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { SessionEffort } from "../attendance/session-effort";
import { rateSessionEffort } from "@/app/actions/session-effort";

beforeEach(() => jest.clearAllMocks());

describe("SessionEffort", () => {
  it("shows the current rating as pressed", () => {
    render(<SessionEffort sessionId="s1" initialRpe={7} />);
    expect(screen.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Easy" })).toHaveAttribute("aria-pressed", "false");
  });

  it("saves a tap and says how many children it covered", async () => {
    (rateSessionEffort as jest.Mock).mockResolvedValue({ success: true, count: 14 });
    render(<SessionEffort sessionId="s1" initialRpe={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Very hard" }));
    await waitFor(() => expect(rateSessionEffort).toHaveBeenCalledWith("s1", 9));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved for 14 children."));
    expect(screen.getByRole("button", { name: "Very hard" })).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the old value back and shows the reason when saving fails", async () => {
    (rateSessionEffort as jest.Mock).mockResolvedValue({ error: "Nope" });
    render(<SessionEffort sessionId="s1" initialRpe={5} />);
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
    expect(screen.getByRole("button", { name: "Okay" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tells the coach to mark the register first when nobody was marked present", async () => {
    (rateSessionEffort as jest.Mock).mockResolvedValue({ success: true, count: 0 });
    render(<SessionEffort sessionId="s1" initialRpe={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Mark who came first, then rate it again."));
  });
});

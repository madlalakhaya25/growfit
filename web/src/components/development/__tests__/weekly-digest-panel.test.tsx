const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock("@/app/actions/family-messages", () => ({
  draftWeeklyDigests: jest.fn(), draftMatchStories: jest.fn(), saveFamilyMessage: jest.fn(), approveFamilyMessage: jest.fn(), retractFamilyMessage: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WeeklyDigestPanel } from "../weekly-digest-panel";
import { draftWeeklyDigests } from "@/app/actions/family-messages";
import type { StoryRow } from "@/components/fixtures/match-stories-panel";

const rows = (status: "draft" | "approved" = "draft"): StoryRow[] => [
  { playerId: "a", name: "Sipho Dlamini", message: { id: "m1", body: "A kind note", status, approvedByName: status === "approved" ? "Coach K" : null } },
  { playerId: "b", name: "Bheki Zulu", message: null },
];

beforeEach(() => jest.clearAllMocks());

describe("WeeklyDigestPanel", () => {
  it("lists a note to edit and nothing for a child without one", () => {
    render(<WeeklyDigestPanel teamId="t1" rows={rows()} available />);
    expect(screen.getByLabelText("Note for Sipho Dlamini")).toHaveValue("A kind note");
    expect(screen.queryByText("Bheki Zulu")).toBeNull();
  });

  it("writes the notes for this team and refreshes", async () => {
    (draftWeeklyDigests as jest.Mock).mockResolvedValue({ created: 3 });
    render(<WeeklyDigestPanel teamId="t1" rows={[]} available />);
    fireEvent.click(screen.getByRole("button", { name: "Write this week's notes" }));
    await waitFor(() => expect(draftWeeklyDigests).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("offers a WhatsApp copy only once a note is shared", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const draft = render(<WeeklyDigestPanel teamId="t1" rows={rows()} available />);
    expect(screen.queryByRole("button", { name: "Copy for WhatsApp" })).toBeNull();
    draft.unmount();
    render(<WeeklyDigestPanel teamId="t1" rows={rows("approved")} available />);
    fireEvent.click(screen.getByRole("button", { name: "Copy for WhatsApp" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("A kind note"));
  });

  it("explains a missing database update and disables writing", () => {
    render(<WeeklyDigestPanel teamId="t1" rows={[]} available={false} />);
    expect(screen.getByText(/migration 058/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Write this week's notes" })).toBeDisabled();
  });
});

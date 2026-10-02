jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/app/actions/family-messages", () => ({
  draftMatchStories: jest.fn(), saveFamilyMessage: jest.fn(), approveFamilyMessage: jest.fn(), retractFamilyMessage: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchStoriesPanel, type StoryRow } from "../match-stories-panel";
import { approveFamilyMessage, retractFamilyMessage, saveFamilyMessage } from "@/app/actions/family-messages";

const rows = (status: "draft" | "approved" = "draft", body = "A kind story"): StoryRow[] => [
  { playerId: "a", name: "Sipho Dlamini", message: { id: "m1", body, status, approvedByName: status === "approved" ? "Coach K" : null } },
  { playerId: "b", name: "Bheki Zulu", message: null },
];

beforeEach(() => jest.clearAllMocks());

describe("MatchStoriesPanel", () => {
  it("shows a draft to edit and nothing for a child with no story", () => {
    render(<MatchStoriesPanel fixtureId="f1" rows={rows()} available />);
    expect(screen.getByLabelText("Story for Sipho Dlamini")).toHaveValue("A kind story");
    expect(screen.queryByText("Bheki Zulu")).toBeNull();
  });

  it("saves edits before sharing, then marks it shared", async () => {
    (saveFamilyMessage as jest.Mock).mockResolvedValue({ success: true });
    (approveFamilyMessage as jest.Mock).mockResolvedValue({ success: true });
    render(<MatchStoriesPanel fixtureId="f1" rows={rows()} available />);
    fireEvent.change(screen.getByLabelText("Story for Sipho Dlamini"), { target: { value: "Edited story" } });
    fireEvent.click(screen.getByRole("button", { name: "Share with family" }));
    await waitFor(() => expect(approveFamilyMessage).toHaveBeenCalledWith("m1"));
    expect(saveFamilyMessage).toHaveBeenCalledWith("m1", "Edited story");
    await waitFor(() => expect(screen.getByText("Edited story")).toBeInTheDocument());
  });

  it("warns live about wording that may read as negative", () => {
    render(<MatchStoriesPanel fixtureId="f1" rows={rows("draft", "He was weak today")} available />);
    expect(screen.getByText(/May read as negative: weak/)).toBeInTheDocument();
  });

  it("asks before sharing flagged wording and does not share if the coach says no", async () => {
    (approveFamilyMessage as jest.Mock).mockResolvedValue({ flagged: true, error: "May read as negative" });
    jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<MatchStoriesPanel fixtureId="f1" rows={rows("draft", "He was weak today")} available />);
    fireEvent.click(screen.getByRole("button", { name: "Share with family" }));
    await waitFor(() => expect(approveFamilyMessage).toHaveBeenCalledTimes(1));
    expect(approveFamilyMessage).not.toHaveBeenCalledWith("m1", { acknowledgeWording: true });
    expect(screen.getByLabelText("Story for Sipho Dlamini")).toBeInTheDocument();
  });

  it("lets a coach take a shared story back to a draft", async () => {
    (retractFamilyMessage as jest.Mock).mockResolvedValue({ success: true });
    render(<MatchStoriesPanel fixtureId="f1" rows={rows("approved")} available />);
    expect(screen.getByText(/Shared by Coach K/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Take back/ }));
    await waitFor(() => expect(retractFamilyMessage).toHaveBeenCalledWith("m1"));
    expect(await screen.findByLabelText("Story for Sipho Dlamini")).toBeInTheDocument();
  });

  it("explains when the table is not there yet and disables writing", () => {
    render(<MatchStoriesPanel fixtureId="f1" rows={[]} available={false} />);
    expect(screen.getByText(/migration 058/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Write the stories/ })).toBeDisabled();
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockGenerate = jest.fn();
const mockApprove = jest.fn();
const mockFeedback = jest.fn();
jest.mock("@/app/actions/development-plan", () => ({
  generateDevelopmentPlan: (...a: unknown[]) => mockGenerate(...a),
  approveDevelopmentPlan: (...a: unknown[]) => mockApprove(...a),
  setDevelopmentPlanFeedback: (...a: unknown[]) => mockFeedback(...a),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { DevelopmentPlanPanel, type InitialDevelopmentPlan } from "../development-plan-panel";

const stored: InitialDevelopmentPlan = {
  artefactId: "a1",
  plan: "PLAYER SUMMARY: A composed midfielder.",
  generatedAt: "2026-10-03T08:00:00Z",
  status: "draft",
  approvedByName: null,
  feedback: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFeedback.mockResolvedValue({ success: true });
});

describe("DevelopmentPlanPanel", () => {
  it("shows the stored plan on load with provenance — Tuesday's plan is there on Wednesday", () => {
    render(<DevelopmentPlanPanel playerId="p1" initial={stored} />);
    expect(screen.getByText(/A composed midfielder/)).toBeInTheDocument();
    expect(screen.getByText(/Generated 0?3 Oct/)).toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("with nothing stored, offers Generate and calls the action without force", async () => {
    mockGenerate.mockResolvedValue({ plan: "FOCUS AREAS:", artefactId: "a2", status: "draft", cached: false, persisted: true, generatedAt: "2026-10-04T08:00:00Z" });
    render(<DevelopmentPlanPanel playerId="p1" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /generate plan/i })); });
    expect(mockGenerate).toHaveBeenCalledWith({ playerId: "p1", force: false });
    expect(await screen.findByText(/FOCUS AREAS/)).toBeInTheDocument();
  });

  it("a draft says only coaches can see it and offers Approve; approving reports who", async () => {
    mockApprove.mockResolvedValue({ success: true, approvedByName: "Sphe Mlotshwa" });
    render(<DevelopmentPlanPanel playerId="p1" initial={stored} />);
    expect(screen.getByText(/only coaches can see this/i)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /approve & share/i })); });
    expect(mockApprove).toHaveBeenCalledWith("a1");
    expect(await screen.findByText(/Approved by Sphe Mlotshwa — shared with the player and parent/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve & share/i })).not.toBeInTheDocument();
  });

  it("a failed approval keeps it a draft", async () => {
    mockApprove.mockResolvedValue({ error: "Couldn't approve the plan. Try again." });
    render(<DevelopmentPlanPanel playerId="p1" initial={stored} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /approve & share/i })); });
    expect(screen.getByText(/only coaches can see this/i)).toBeInTheDocument();
  });

  it("an already-approved plan shows who approved it and no Approve button", () => {
    render(<DevelopmentPlanPanel playerId="p1" initial={{ ...stored, status: "approved", approvedByName: "Buhle Madlala" }} />);
    expect(screen.getByText(/Approved by Buhle Madlala/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("Refresh with nothing changed says so, and offers to regenerate anyway with force", async () => {
    mockGenerate.mockResolvedValueOnce({ plan: stored.plan, artefactId: "a1", status: "draft", cached: true, persisted: true, generatedAt: stored.generatedAt });
    render(<DevelopmentPlanPanel playerId="p1" initial={stored} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /refresh/i })); });
    expect(mockGenerate).toHaveBeenLastCalledWith({ playerId: "p1", force: false });
    expect(await screen.findByText(/Nothing has changed since this plan was made/)).toBeInTheDocument();

    mockGenerate.mockResolvedValueOnce({ plan: "NEW PLAN", artefactId: "a2", status: "draft", cached: false, persisted: true, generatedAt: "2026-10-05T08:00:00Z" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /regenerate anyway/i })); });
    expect(mockGenerate).toHaveBeenLastCalledWith({ playerId: "p1", force: true });
    expect(await screen.findByText(/NEW PLAN/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing has changed/)).not.toBeInTheDocument();
  });

  it("a freshly regenerated plan is a draft again, even if the last one was approved", async () => {
    mockGenerate.mockResolvedValueOnce({ plan: "NEW PLAN", artefactId: "a2", status: "draft", cached: false, persisted: true, generatedAt: "2026-10-05T08:00:00Z", approvedByName: null });
    render(<DevelopmentPlanPanel playerId="p1" initial={{ ...stored, status: "approved", approvedByName: "Buhle Madlala" }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /refresh/i })); });
    expect(await screen.findByText(/only coaches can see this/i)).toBeInTheDocument();
    expect(screen.queryByText(/Approved by/)).not.toBeInTheDocument();
  });

  it("an error from the action is shown with a retry", async () => {
    mockGenerate.mockResolvedValue({ error: "You don't coach this player." });
    render(<DevelopmentPlanPanel playerId="p1" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /generate plan/i })); });
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't coach this player.");
  });

  it("says so when the plan could not be saved (migration pending)", async () => {
    mockGenerate.mockResolvedValue({ plan: "PLAN", status: "draft", persisted: false, cached: false, generatedAt: "2026-10-05T08:00:00Z" });
    render(<DevelopmentPlanPanel playerId="p1" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /generate plan/i })); });
    expect(await screen.findByText(/couldn't be saved/)).toBeInTheDocument();
    // nothing to approve or rate without a stored artefact
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /useful/i })).not.toBeInTheDocument();
  });

  it("feedback is saved, and rolled back if saving fails", async () => {
    render(<DevelopmentPlanPanel playerId="p1" initial={stored} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Helpful" })); });
    expect(mockFeedback).toHaveBeenCalledWith("a1", "helpful");
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute("aria-pressed", "true");

    mockFeedback.mockResolvedValueOnce({ error: "nope" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Not helpful" })); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Not helpful" })).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute("aria-pressed", "true");
  });
});

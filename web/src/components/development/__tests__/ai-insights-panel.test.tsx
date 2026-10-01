import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockInsights = jest.fn();
jest.mock("@/app/actions/ai-insights", () => ({ getPlayerInsights: (...a: unknown[]) => mockInsights(...a) }));
const mockFeedback = jest.fn();
jest.mock("@/app/actions/ai-feedback", () => ({ setAiArtefactFeedback: (...a: unknown[]) => mockFeedback(...a) }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import { AiInsightsPanel } from "../ai-insights-panel";

const stored = { artefactId: "a1", text: "STRENGTHS: - good", generatedAt: "2026-10-03T08:00:00Z", feedback: null };

beforeEach(() => { jest.clearAllMocks(); mockFeedback.mockResolvedValue({ success: true }); });

describe("AiInsightsPanel (stored AI)", () => {
  it("shows the stored result with provenance, without calling the model", () => {
    render(<AiInsightsPanel playerId="p1" initial={stored} />);
    expect(screen.getByText(/STRENGTHS/)).toBeInTheDocument();
    expect(screen.getByText(/Generated 0?3 Oct/)).toBeInTheDocument();
    expect(mockInsights).not.toHaveBeenCalled();
  });

  it("generates without force, then offers 'regenerate anyway' when nothing changed", async () => {
    mockInsights.mockResolvedValueOnce({ insights: "SAME", artefactId: "a1", cached: true, persisted: true, generatedAt: stored.generatedAt });
    render(<AiInsightsPanel playerId="p1" initial={stored} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /refresh/i })); });
    expect(mockInsights).toHaveBeenLastCalledWith("p1", { force: false });
    expect(await screen.findByText(/Nothing has changed/)).toBeInTheDocument();

    mockInsights.mockResolvedValueOnce({ insights: "FRESH", artefactId: "a2", cached: false, persisted: true, generatedAt: "2026-10-05T08:00:00Z" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /regenerate anyway/i })); });
    expect(mockInsights).toHaveBeenLastCalledWith("p1", { force: true });
    expect(await screen.findByText(/FRESH/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing has changed/)).not.toBeInTheDocument();
  });

  it("an unsaved result has nothing to rate", async () => {
    mockInsights.mockResolvedValueOnce({ insights: "TEXT", persisted: false, cached: false });
    render(<AiInsightsPanel playerId="p1" />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /generate insights/i })); });
    expect(await screen.findByText(/couldn't be saved/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /useful/i })).not.toBeInTheDocument();
  });

  it("feedback is saved, and rolled back when saving fails", async () => {
    render(<AiInsightsPanel playerId="p1" initial={stored} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Helpful" })); });
    expect(mockFeedback).toHaveBeenCalledWith("a1", "helpful");
    mockFeedback.mockResolvedValueOnce({ error: "nope" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Not helpful" })); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Not helpful" })).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute("aria-pressed", "true");
  });
});

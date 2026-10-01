import { fireEvent, render, screen } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { AiPanel, type AiPanelProps } from "../ai-panel";

const base: AiPanelProps = {
  icon: Sparkles,
  title: "Coaching Insights",
  idleMessage: "Get recommendations.",
  pendingMessage: "Analysing…",
  generateLabel: "Generate insights",
  content: null,
  pending: false,
  error: null,
  onGenerate: () => {},
};

describe("AiPanel", () => {
  it("idle: says what generating does and offers a Generate button", () => {
    const onGenerate = jest.fn();
    render(<AiPanel {...base} onGenerate={onGenerate} />);
    expect(screen.getByText("Get recommendations.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /generate insights/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });

  it("pending: shows a labelled spinner and the message, and no buttons to double-fire", () => {
    render(<AiPanel {...base} pending />);
    expect(screen.getByRole("status", { name: "Analysing…" })).toBeInTheDocument();
    expect(screen.getByText("Analysing…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Get recommendations.")).not.toBeInTheDocument();
  });

  it("pending with existing content hides the stale content while regenerating", () => {
    render(<AiPanel {...base} content="Old answer" pending />);
    expect(screen.queryByText("Old answer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeDisabled();
  });

  it("error: announces it and offers a retry that regenerates", () => {
    const onGenerate = jest.fn();
    render(<AiPanel {...base} error="You've hit the AI limit." onGenerate={onGenerate} />);
    expect(screen.getByRole("alert")).toHaveTextContent("You've hit the AI limit.");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Get recommendations.")).not.toBeInTheDocument();
  });

  it("content: renders the answer with provenance and a Refresh, instead of an empty prompt", () => {
    render(<AiPanel {...base} content="First line" generatedAt="2026-10-03T08:00:00Z" />);
    expect(screen.getByText("First line")).toBeInTheDocument();
    expect(screen.getByText(/Generated 0?3 Oct/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeEnabled();
    expect(screen.queryByText("Get recommendations.")).not.toBeInTheDocument();
  });

  it("content without a timestamp shows no provenance text rather than a wrong one", () => {
    render(<AiPanel {...base} content="First line" />);
    expect(screen.queryByText(/Generated/)).not.toBeInTheDocument();
  });

  it("read-only: no generate, refresh, retry or feedback controls anywhere", () => {
    const { rerender } = render(<AiPanel {...base} readOnly />);
    expect(screen.getByText("Get recommendations.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<AiPanel {...base} readOnly content="Plan text" feedback={{ value: null, onChange: () => {} }} />);
    expect(screen.getByText("Plan text")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<AiPanel {...base} readOnly error="Boom" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("feedback: thumbs report the choice, and pressing the active one clears it", () => {
    const onChange = jest.fn();
    const { rerender } = render(<AiPanel {...base} content="Answer" feedback={{ value: null, onChange }} />);
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    expect(onChange).toHaveBeenLastCalledWith("helpful");

    rerender(<AiPanel {...base} content="Answer" feedback={{ value: "helpful", onChange }} />);
    expect(screen.getByRole("button", { name: "Helpful" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Not helpful" }));
    expect(onChange).toHaveBeenLastCalledWith("not_helpful");
  });

  it("feedback is hidden before there is anything to rate", () => {
    render(<AiPanel {...base} feedback={{ value: null, onChange: () => {} }} />);
    expect(screen.queryByRole("group", { name: /useful/i })).not.toBeInTheDocument();
  });

  it("does not describe itself as AI-powered", () => {
    const { container } = render(<AiPanel {...base} content="x" />);
    expect(container.textContent ?? "").not.toMatch(/AI-powered/i);
  });
});

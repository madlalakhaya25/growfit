import { render, screen } from "@testing-library/react";
import { AiUsageCard } from "../ai-usage-card";
import type { AiUsageSummary } from "@/lib/ai-artefacts";

const tileValue = (label: string) => screen.getByText(label).closest("div")!.nextElementSibling as HTMLElement;
const summary = (o: Partial<AiUsageSummary> = {}): AiUsageSummary => ({
  calls: 12, totalTokens: 48210, helpful: 5, notHelpful: 1, byKind: [], ...o,
});

describe("AiUsageCard", () => {
  it("shows calls, tokens and the helpful ratio", () => {
    render(<AiUsageCard summary={summary()} available />);
    expect(tileValue("Results")).toHaveTextContent("12");
    expect(tileValue("Tokens").textContent).toMatch(/48\D?210/);
    expect(tileValue("Found helpful")).toHaveTextContent("5 of 6");
  });

  it("a failed read (or missing table) is — in every tile, never a believable 0", () => {
    render(<AiUsageCard summary={null} available={false} />);
    for (const label of ["Results", "Tokens", "Found helpful"]) expect(tileValue(label)).toHaveTextContent("—");
    expect(screen.getByText(/once the latest database update has been applied/)).toBeInTheDocument();
  });

  it("a real zero is a real zero — but tokens stay — until something measured them", () => {
    render(<AiUsageCard summary={summary({ calls: 0, totalTokens: null, helpful: 0, notHelpful: 0 })} available />);
    expect(tileValue("Results")).toHaveTextContent("0");
    expect(tileValue("Tokens")).toHaveTextContent("—");
    expect(tileValue("Found helpful")).toHaveTextContent("None rated");
  });

  it("zero measured tokens is shown as 0, not hidden", () => {
    render(<AiUsageCard summary={summary({ totalTokens: 0 })} available />);
    expect(tileValue("Tokens")).toHaveTextContent("0");
  });
});

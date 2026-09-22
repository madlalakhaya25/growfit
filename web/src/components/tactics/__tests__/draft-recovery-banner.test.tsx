import { render, screen, fireEvent } from "@testing-library/react";
import { DraftRecoveryBanner } from "@/components/tactics/draft-recovery-banner";
import type { BoardDraft } from "@/components/tactics/tactical-board";

const draft: BoardDraft = {
  state: { tokens: [], shapes: [], objects: [], playerNotes: [] },
  frames: [{ id: "f1", tokens: [], shapes: [] }, { id: "f2", tokens: [], shapes: [] }],
  pitchId: "full",
  playName: "High press trigger",
  savedAt: Date.parse("2026-09-20T10:00:00Z"),
};

describe("DraftRecoveryBanner", () => {
  it("shows the draft's name and step count", () => {
    render(<DraftRecoveryBanner draft={draft} onRestore={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.getByText("You have an unsaved board")).toBeInTheDocument();
    expect(screen.getByText(/High press trigger/)).toBeInTheDocument();
    expect(screen.getByText(/2 steps/)).toBeInTheDocument();
  });

  it("calls onRestore when 'Restore it' is clicked", () => {
    const onRestore = jest.fn();
    render(<DraftRecoveryBanner draft={draft} onRestore={onRestore} onDiscard={jest.fn()} />);
    fireEvent.click(screen.getByText("Restore it"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when 'Discard' is clicked", () => {
    const onDiscard = jest.fn();
    render(<DraftRecoveryBanner draft={draft} onRestore={jest.fn()} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByText("Discard"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("omits the name prefix and step count when the draft has neither", () => {
    const bare: BoardDraft = { state: draft.state, frames: [], pitchId: "full", savedAt: draft.savedAt };
    render(<DraftRecoveryBanner draft={bare} onRestore={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.queryByText(/step/)).not.toBeInTheDocument();
  });
});

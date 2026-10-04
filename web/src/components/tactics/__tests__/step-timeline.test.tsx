import { act, fireEvent, render, screen } from "@testing-library/react";
import { StepTimeline } from "@/components/tactics/step-timeline";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";
import type { Frame } from "@/lib/board-model";

const step = (id: string, x: number, durationMs?: number): Frame => ({ id, tokens: [{ id: "a", x, y: 0 }], shapes: [], durationMs });

function setup(frames: Frame[]) {
  act(() => {
    useBoardPlaybackStore.getState().reset();
    useBoardPlaybackStore.getState().setFrames(frames);
  });
  const props = {
    scrubTo: jest.fn(),
    endScrub: jest.fn(),
    gotoFrame: jest.fn(),
    setFrameDuration: jest.fn(),
    snapshot: jest.fn(),
  };
  render(<StepTimeline {...props} />);
  return props;
}

describe("StepTimeline", () => {
  it("shows nothing until there are two steps", () => {
    setup([step("s1", 0)]);
    expect(screen.queryByTestId("step-timeline")).not.toBeInTheDocument();
  });

  it("has a labelled slider over the whole move and a chip per step", () => {
    setup([step("s1", 0), step("s2", 10, 500), step("s3", 20)]);
    const slider = screen.getByRole("slider", { name: "Scrub through the move" });
    expect(slider).toHaveAttribute("max", "1600");
    expect(screen.getAllByRole("button", { name: /^Step \d/ })).toHaveLength(3);
    // Old steps keep the 1.1s default.
    expect(screen.getByRole("button", { name: /Step 3/ })).toHaveTextContent("1.1s");
  });

  it("scrubs as the slider moves and goes back to editing on release", () => {
    const props = setup([step("s1", 0), step("s2", 10, 500)]);
    const slider = screen.getByRole("slider", { name: "Scrub through the move" });
    fireEvent.change(slider, { target: { value: "250" } });
    expect(props.scrubTo).toHaveBeenCalledWith(250);
    fireEvent.pointerUp(slider);
    expect(props.endScrub).toHaveBeenCalled();
  });

  it("jumps to a step and lets its duration be changed", () => {
    const props = setup([step("s1", 0), step("s2", 10, 500), step("s3", 20, 1000)]);
    fireEvent.click(screen.getByRole("button", { name: /Step 3/ }));
    expect(props.gotoFrame).toHaveBeenCalledWith(2);
    // Step 3 is reached after step 2's 0.5s and its own 1s.
    expect(useBoardPlaybackStore.getState().scrubMs).toBe(1500);

    const select = screen.getByRole("combobox", { name: "Step 3 takes" });
    expect(select).toHaveValue("1000");
    fireEvent.change(select, { target: { value: "2500" } });
    expect(props.snapshot).toHaveBeenCalled();
    expect(props.setFrameDuration).toHaveBeenCalledWith(2, 2500);
  });

  it("explains that the first step has no duration", () => {
    setup([step("s1", 0), step("s2", 10)]);
    fireEvent.click(screen.getByRole("button", { name: /Step 1/ }));
    expect(screen.getByText("Step 1 is where everyone starts.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("locks while the move is playing", () => {
    setup([step("s1", 0), step("s2", 10)]);
    act(() => useBoardPlaybackStore.getState().setPlaying(true));
    expect(screen.getByRole("slider", { name: "Scrub through the move" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Step 2/ })).toBeDisabled();
  });
});

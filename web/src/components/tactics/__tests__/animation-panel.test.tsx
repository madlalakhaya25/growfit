import { render, screen } from "@testing-library/react";
import { AnimationPanel } from "@/components/tactics/animation-panel";

const noop = () => {};

describe("AnimationPanel", () => {
  it("renders the play-sequence card with no steps captured yet", () => {
    render(
      <AnimationPanel
        captureFrame={noop}
        stopPlayback={noop}
        playAnimation={noop}
        recordAnimation={noop}
        snapshot={noop}
        scrubTo={noop}
        endScrub={noop}
        gotoFrame={noop}
        setFrameDuration={noop}
        updateFrame={noop}
        insertFrameAfter={noop}
        duplicateFrame={noop}
        deleteFrame={noop}
        moveFrame={noop}
      />
    );

    expect(screen.getByText("Play sequence")).toBeInTheDocument();
    expect(screen.getByText("Capture step")).toBeInTheDocument();
    expect(screen.getByText("Play")).toBeInTheDocument();
    expect(screen.getByText("No steps captured yet.")).toBeInTheDocument();
  });
});

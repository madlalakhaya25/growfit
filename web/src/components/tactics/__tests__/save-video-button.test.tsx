import { fireEvent, render, screen } from "@testing-library/react";
import { SaveVideoButton } from "@/components/tactics/save-video-button";

describe("SaveVideoButton", () => {
  const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  afterEach(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
    delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream;
  });

  function supportVideo() {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = class {};
    (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream = jest.fn();
  }

  it("is disabled with a short reason when the browser can't record (jsdom has no MediaRecorder)", () => {
    const onSave = jest.fn();
    render(<SaveVideoButton onSave={onSave} recording={false} />);
    const button = screen.getByRole("button", { name: "Save as video" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/can't save video/i);
    fireEvent.click(button);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves when the browser can record", () => {
    supportVideo();
    const onSave = jest.fn();
    render(<SaveVideoButton onSave={onSave} recording={false} />);
    const button = screen.getByRole("button", { name: "Save as video" });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/can't save video/i)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("says why when the board can't be recorded yet", () => {
    supportVideo();
    render(<SaveVideoButton onSave={jest.fn()} recording={false} blockedReason="Video needs the full pitch." />);
    expect(screen.getByRole("button", { name: "Save as video" })).toBeDisabled();
    expect(screen.getByText("Video needs the full pitch.")).toBeInTheDocument();
  });

  it("is busy while a video is being saved", () => {
    supportVideo();
    render(<SaveVideoButton onSave={jest.fn()} recording />);
    expect(screen.getByRole("button", { name: "Saving video…" })).toBeDisabled();
  });

  it("is greyed out with nothing on the board", () => {
    supportVideo();
    render(<SaveVideoButton onSave={jest.fn()} recording={false} disabled />);
    expect(screen.getByRole("button", { name: "Save as video" })).toBeDisabled();
  });
});

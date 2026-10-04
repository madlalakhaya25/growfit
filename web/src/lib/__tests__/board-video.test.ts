import { canRecordVideo, videoFileName, videoFrameTimes, VIDEO_FPS, VIDEO_HOLD_MS } from "@/lib/board-video";

describe("videoFrameTimes", () => {
  it("covers the move from 0 to the end, one frame per 1/fps", () => {
    const times = videoFrameTimes(1000, 10, 0);
    expect(times).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it("always lands on the last pose even when it doesn't divide evenly", () => {
    const times = videoFrameTimes(250, 10, 0);
    expect(times).toEqual([0, 100, 200, 250]);
  });

  it("holds the last pose for the hold time", () => {
    const times = videoFrameTimes(200, 10, 300);
    expect(times).toEqual([0, 100, 200, 200, 200, 200]);
  });

  it("never runs backwards and never passes the end", () => {
    const times = videoFrameTimes(3300);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    expect(Math.max(...times)).toBe(3300);
    // 3.3s of movement + the hold at 30fps, give or take a frame.
    expect(times.length).toBe(Math.ceil(3300 / (1000 / VIDEO_FPS)) + 1 + Math.round(VIDEO_HOLD_MS / (1000 / VIDEO_FPS)));
  });

  it("still makes a frame for an empty move", () => {
    expect(videoFrameTimes(0, 30, 0)).toEqual([0, 0]);
  });
});

describe("videoFileName", () => {
  it("names the file after the play", () => {
    expect(videoFileName("High press", "U13 Lions", "video/webm;codecs=vp9")).toBe("high-press.webm");
  });
  it("tidies punctuation and spaces", () => {
    expect(videoFileName("  Switch play -> far side!! ", null, "video/webm")).toBe("switch-play-far-side.webm");
  });
  it("falls back to the team, then to 'play'", () => {
    expect(videoFileName("", "U13 Lions", "video/webm")).toBe("u13-lions.webm");
    expect(videoFileName("!!!", undefined, "video/webm")).toBe("play.webm");
  });
  it("uses .mp4 when that's what the browser recorded", () => {
    expect(videoFileName("Overload", null, "video/mp4")).toBe("overload.mp4");
  });
});

describe("canRecordVideo", () => {
  const original = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  afterEach(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = original;
    delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream;
  });

  it("is false in jsdom, which has neither MediaRecorder nor captureStream", () => {
    expect(canRecordVideo()).toBe(false);
  });

  it("needs captureStream as well as MediaRecorder", () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = class {};
    expect(canRecordVideo()).toBe(false);
    (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream = jest.fn();
    expect(canRecordVideo()).toBe(true);
  });
});

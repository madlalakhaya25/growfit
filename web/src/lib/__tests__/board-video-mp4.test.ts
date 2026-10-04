const mockCanEncode = jest.fn();
const mockAdd = jest.fn();
const mockStart = jest.fn();
const mockFinalize = jest.fn();
const mockAddTrack = jest.fn();
jest.mock("mediabunny", () => {
  class BufferTarget { buffer: ArrayBuffer | null = null; }
  return {
    QUALITY_HIGH: "high",
    canEncodeVideo: (...a: unknown[]) => mockCanEncode(...a),
    BufferTarget,
    Mp4OutputFormat: class { constructor(public options: unknown) {} },
    CanvasSource: class { constructor(public canvas: unknown, public config: unknown) {} add(...a: unknown[]) { return mockAdd(...a); } },
    Output: class {
      constructor(public opts: { target: { buffer: ArrayBuffer | null } }) {}
      addVideoTrack(...a: unknown[]) { mockAddTrack(...a); }
      start() { return mockStart(); }
      async finalize() { await mockFinalize(); this.opts.target.buffer = new ArrayBuffer(8); }
    },
  };
});
const mockRecord = jest.fn();
jest.mock("@/lib/board-video", () => ({ ...jest.requireActual("@/lib/board-video"), recordMoveVideo: (...a: unknown[]) => mockRecord(...a) }));

import {
  MP4_HEIGHT, MP4_SCALE, MP4_WIDTH, canMakeMp4, drawPortraitFrame, fitCaption, makeMp4Video, makeShareVideo,
} from "../board-video-mp4";
import { VIDEO_FPS } from "../board-video";
import type { Frame, Token } from "../board-model";

const tokens: Token[] = [
  { id: "a", label: "Sipho", x: 50, y: 120, kind: "player", group: "Defender" },
  { id: "b", label: "9", x: 50, y: 30, kind: "opponent", group: "Opponent" },
];
const frames: Frame[] = [
  { id: "f1", tokens: [{ id: "a", x: 50, y: 120 }, { id: "b", x: 50, y: 30 }], shapes: [], durationMs: 500 },
  { id: "f2", tokens: [{ id: "a", x: 50, y: 90 }, { id: "b", x: 50, y: 30 }], shapes: [], durationMs: 500 },
] as unknown as Frame[];
const captions = { title: "High press", subtitle: "U13 Lions · U13" };

function fakeCtx() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : (...args: unknown[]) => {
      calls.push({ fn: k, args });
      if (k === "measureText") return { width: 10 };
      if (k === "createRadialGradient" || k === "createLinearGradient") return { addColorStop: () => undefined };
      return undefined;
    }),
    set: (t, k: string, v) => { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeCtx().ctx as never);
  mockCanEncode.mockResolvedValue(true);
  mockAdd.mockResolvedValue(undefined);
  mockStart.mockResolvedValue(undefined);
  Object.defineProperty(globalThis, "Path2D", { value: class {}, configurable: true });
  Object.defineProperty(globalThis, "VideoEncoder", { value: class {}, configurable: true });
});
afterEach(() => { jest.restoreAllMocks(); delete (globalThis as { VideoEncoder?: unknown }).VideoEncoder; delete (globalThis as { Path2D?: unknown }).Path2D; });

describe("the portrait picture", () => {
  it("is 9:16 with the pitch filling the full width", () => {
    expect(MP4_WIDTH / MP4_HEIGHT).toBeCloseTo(9 / 16);
    expect(MP4_SCALE * 100).toBe(MP4_WIDTH);
    expect(MP4_SCALE * 150 + 110).toBeLessThan(MP4_HEIGHT);
  });
  it("keeps a caption to one line", () => {
    expect(fitCaption("  High   press ", 28)).toBe("High press");
    expect(fitCaption("x".repeat(40), 10)).toBe("xxxxxxxxx…");
  });
  it("draws the title, team line and brand, with the pitch pushed under the header", () => {
    const { ctx, calls } = fakeCtx();
    drawPortraitFrame(ctx, { baseTokens: tokens, frames, ms: 0, overlay: "none", showNames: true, captions });
    const text = calls.filter((c) => c.fn === "fillText").map((c) => c.args[0]);
    expect(text).toEqual(expect.arrayContaining(["High press", "U13 Lions · U13", "Growfit"]));
    expect(calls.find((c) => c.fn === "translate")?.args).toEqual([0, 110]);
    // Only the first name on the token and nothing else about the player is drawn.
    expect(text).toContain("Sipho");
  });
});

describe("makeMp4Video", () => {
  it("says no where the browser cannot encode H.264, without touching the encoder", async () => {
    mockCanEncode.mockResolvedValue(false);
    expect(await canMakeMp4()).toBe(false);
    expect(await makeMp4Video({ baseTokens: tokens, frames, overlay: "none", showNames: true, captions })).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
  });
  it("says no where there is no WebCodecs", async () => {
    delete (globalThis as { VideoEncoder?: unknown }).VideoEncoder;
    expect(await canMakeMp4()).toBe(false);
  });
  it("adds one frame per 1/30 s in order and returns an MP4", async () => {
    const out = await makeMp4Video({ baseTokens: tokens, frames, overlay: "none", showNames: true, captions });
    expect(out?.mime).toBe("video/mp4");
    expect(out?.blob.type).toBe("video/mp4");
    expect(mockAddTrack).toHaveBeenCalledWith(expect.anything(), { frameRate: VIDEO_FPS });
    const stamps = mockAdd.mock.calls.map((c) => c[0] as number);
    expect(stamps.length).toBeGreaterThan(VIDEO_FPS); // 1 s of move plus the held last pose
    expect(stamps[0]).toBe(0);
    for (let i = 1; i < stamps.length; i++) expect(stamps[i]).toBeCloseTo(i / VIDEO_FPS);
    expect(mockAdd.mock.calls[0][1]).toBeCloseTo(1 / VIDEO_FPS);
    expect(mockFinalize).toHaveBeenCalledTimes(1);
  });
});

describe("makeShareVideo", () => {
  const opts = { baseTokens: tokens, frames, overlay: "none" as const, showNames: true, captions };
  it("prefers the MP4", async () => {
    expect((await makeShareVideo(opts))?.mime).toBe("video/mp4");
    expect(mockRecord).not.toHaveBeenCalled();
  });
  it("falls back to recording the canvas when H.264 is not available", async () => {
    mockCanEncode.mockResolvedValue(false);
    mockRecord.mockResolvedValue({ blob: new Blob(["x"]), mime: "video/webm" });
    expect((await makeShareVideo(opts))?.mime).toBe("video/webm");
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });
});

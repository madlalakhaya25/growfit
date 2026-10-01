import { act, renderHook } from "@testing-library/react";
import { extensionForMime, pickAudioMime, useVoiceCapture } from "../use-voice-capture";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = ["audio/webm"];
  static isTypeSupported = (m: string) => FakeRecorder.supported.includes(m);
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => Promise<void> | void) | null = null;
  constructor(public stream: unknown, public opts: { mimeType: string }) { FakeRecorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; void this.onstop?.(); }
}
const track = { stop: jest.fn() };
const getUserMedia = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  FakeRecorder.instances = [];
  FakeRecorder.supported = ["audio/webm"];
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  getUserMedia.mockResolvedValue({ getTracks: () => [track] });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
});
afterEach(() => { jest.useRealTimers(); });

describe("pickAudioMime / extensionForMime", () => {
  it("picks the first supported type, or null", () => {
    expect(pickAudioMime()).toBe("audio/webm");
    FakeRecorder.supported = [];
    expect(pickAudioMime()).toBeNull();
  });
  it("maps a mime type to an extension", () => {
    expect(extensionForMime("audio/mp4")).toBe("mp4");
    expect(extensionForMime("audio/ogg")).toBe("ogg");
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
  });
});

describe("useVoiceCapture", () => {
  it("records, counts seconds, and hands the finished clip to onCaptured without storing it", async () => {
    const onCaptured = jest.fn();
    const { result } = renderHook(() => useVoiceCapture({ onCaptured }));
    await act(async () => { await result.current.start(); });
    expect(result.current.recording).toBe(true);

    act(() => { FakeRecorder.instances[0].ondataavailable?.({ data: new Blob(["abc"]) }); });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(result.current.seconds).toBe(3);

    await act(async () => { result.current.stop(); });
    expect(result.current.recording).toBe(false);
    expect(track.stop).toHaveBeenCalled();
    expect(onCaptured).toHaveBeenCalledTimes(1);
    const clip = onCaptured.mock.calls[0][0];
    expect(clip).toMatchObject({ mime: "audio/webm", ext: "webm" });
    expect(clip.blob.size).toBe(3);
  });
  it("stops itself at maxSeconds", async () => {
    const onCaptured = jest.fn();
    const { result } = renderHook(() => useVoiceCapture({ maxSeconds: 5, onCaptured }));
    await act(async () => { await result.current.start(); });
    act(() => { FakeRecorder.instances[0].ondataavailable?.({ data: new Blob(["x"]) }); });
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(result.current.recording).toBe(false);
    expect(onCaptured).toHaveBeenCalledTimes(1);
  });
  it("reports an empty recording instead of calling onCaptured", async () => {
    const onCaptured = jest.fn();
    const { result } = renderHook(() => useVoiceCapture({ onCaptured }));
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    expect(result.current.error).toBe("Nothing was recorded.");
    expect(onCaptured).not.toHaveBeenCalled();
  });
  it("explains a browser that can't record and a declined microphone", async () => {
    const { result } = renderHook(() => useVoiceCapture({ onCaptured: jest.fn() }));
    FakeRecorder.supported = [];
    await act(async () => { await result.current.start(); });
    expect(result.current.error).toMatch(/can't record audio/);
    FakeRecorder.supported = ["audio/webm"];
    getUserMedia.mockRejectedValue(new Error("denied"));
    await act(async () => { await result.current.start(); });
    expect(result.current.error).toBe("Microphone permission was declined.");
    expect(result.current.recording).toBe(false);
  });
  it("releases the microphone when it unmounts mid-recording", async () => {
    const { result, unmount } = renderHook(() => useVoiceCapture({ onCaptured: jest.fn() }));
    await act(async () => { await result.current.start(); });
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });
  it("calls the latest onCaptured, not the one from when recording began", async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(({ cb }) => useVoiceCapture({ onCaptured: cb }), { initialProps: { cb: first } });
    await act(async () => { await result.current.start(); });
    rerender({ cb: second });
    act(() => { FakeRecorder.instances[0].ondataavailable?.({ data: new Blob(["x"]) }); });
    await act(async () => { result.current.stop(); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

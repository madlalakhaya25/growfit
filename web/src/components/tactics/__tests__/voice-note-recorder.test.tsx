import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
const mockUpload = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/app/actions/tactic-plays", () => ({
  uploadPlayVoiceNote: (...a: unknown[]) => mockUpload(...a),
  deletePlayVoiceNote: (...a: unknown[]) => mockDelete(...a),
}));

import { VoiceNoteRecorder } from "../voice-note-recorder";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => Promise<void> | void) | null = null;
  constructor() { FakeRecorder.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; void this.onstop?.(); }
}

beforeEach(() => {
  jest.clearAllMocks();
  FakeRecorder.instances = [];
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] }) },
    configurable: true,
  });
  mockUpload.mockResolvedValue({ url: "https://x/voice.webm" });
});

describe("VoiceNoteRecorder (on useVoiceCapture)", () => {
  it("won't record before the play is saved", () => {
    render(<VoiceNoteRecorder playId={null} initialUrl={null} />);
    expect(screen.getByRole("button", { name: /voice note/i })).toBeDisabled();
  });
  it("records, uploads the clip to the play and reports the new url", async () => {
    const onChange = jest.fn();
    render(<VoiceNoteRecorder playId="pl1" initialUrl={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /voice note/i }));
    await screen.findByRole("button", { name: /stop/i });
    act(() => { FakeRecorder.instances[0].ondataavailable?.({ data: new Blob(["abc"]) }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /stop/i })); });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://x/voice.webm"));
    const fd = mockUpload.mock.calls[0][0] as FormData;
    expect(fd.get("play_id")).toBe("pl1");
    expect((fd.get("file") as File).name).toBe("voice-note.webm");
  });
  it("shows an upload error", async () => {
    mockUpload.mockResolvedValue({ error: "Voice note must be under 10 MB." });
    render(<VoiceNoteRecorder playId="pl1" initialUrl={null} />);
    fireEvent.click(screen.getByRole("button", { name: /voice note/i }));
    await screen.findByRole("button", { name: /stop/i });
    act(() => { FakeRecorder.instances[0].ondataavailable?.({ data: new Blob(["abc"]) }); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /stop/i })); });
    expect(await screen.findByText("Voice note must be under 10 MB.")).toBeInTheDocument();
  });
  it("deletes an existing note", async () => {
    mockDelete.mockResolvedValue({});
    const onChange = jest.fn();
    render(<VoiceNoteRecorder playId="pl1" initialUrl="https://x/old.webm" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Delete voice note"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    expect(mockDelete).toHaveBeenCalledWith("pl1");
  });
});

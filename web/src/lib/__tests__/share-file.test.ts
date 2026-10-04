import { canShareFile, shareFile } from "../share-file";

const file = new File(["x"], "play.mp4", { type: "video/mp4" });
const setNav = (v: Partial<Navigator>) => Object.defineProperty(globalThis, "navigator", { value: v, configurable: true });
const original = Object.getOwnPropertyDescriptor(globalThis, "navigator")!;
afterEach(() => Object.defineProperty(globalThis, "navigator", original));

describe("canShareFile", () => {
  it("is false without a share sheet", () => {
    setNav({});
    expect(canShareFile(file)).toBe(false);
  });
  it("is false when the browser cannot share files", () => {
    setNav({ share: jest.fn(), canShare: () => false });
    expect(canShareFile(file)).toBe(false);
  });
  it("is true when it can, and false when asking throws", () => {
    setNav({ share: jest.fn(), canShare: () => true });
    expect(canShareFile(file)).toBe(true);
    setNav({ share: jest.fn(), canShare: () => { throw new Error("no"); } });
    expect(canShareFile(file)).toBe(false);
  });
});

describe("shareFile", () => {
  it("shares the file with its name as the title", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNav({ share });
    expect(await shareFile(file, "play.mp4")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], title: "play.mp4" });
  });
  it("treats backing out as cancelled and anything else as failed", async () => {
    setNav({ share: jest.fn().mockRejectedValue(new DOMException("x", "AbortError")) });
    expect(await shareFile(file, "t")).toBe("cancelled");
    setNav({ share: jest.fn().mockRejectedValue(new Error("boom")) });
    expect(await shareFile(file, "t")).toBe("failed");
  });
});

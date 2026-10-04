import { PDFDocument, StandardFonts } from "pdf-lib";
import { generatePlayHandoutPdf, handoutFileName, hexColor, printable, wrapLines } from "../play-handout-pdf";

const tokens = [
  { label: "Sipho", x: 50, y: 140, kind: "player" as const, group: "Goalkeeper" },
  { label: "Thabo", x: 20, y: 110, kind: "player" as const, group: "Defender" },
  { label: "9", x: 50, y: 30, kind: "opponent" as const, group: "Opponent" },
  { label: "", x: 50, y: 75, kind: "ball" as const, group: "Ball" },
];
const shapes = [
  { id: "a", kind: "run" as const, pts: [{ x: 20, y: 110 }, { x: 10, y: 60 }] },
  { id: "b", kind: "pass" as const, pts: [{ x: 50, y: 140 }, { x: 20, y: 110 }] },
  { id: "c", kind: "zone" as const, pts: [{ x: 30, y: 20 }, { x: 70, y: 20 }, { x: 70, y: 40 }], fill: "hatch" as const },
  { id: "d", kind: "spotlight" as const, pts: [{ x: 20, y: 110 }], radius: 6 },
];

describe("generatePlayHandoutPdf", () => {
  it("makes one A4 portrait page from a board", async () => {
    const bytes = await generatePlayHandoutPdf({ title: "High press", subtitle: "U13 Lions · U13", dateLabel: "4 October 2026", tokens, shapes, instructions: ["Left back overlaps."] });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595, height: 842 });
  });
  it("still makes the file for an empty board, a long title and letters the font lacks", async () => {
    const bytes = await generatePlayHandoutPdf({ title: "Ẅ".repeat(200), subtitle: "", tokens: [], shapes: [], instructions: ["x ".repeat(400), "   "] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe("text helpers", () => {
  it("swaps letters the standard font cannot print for a question mark", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(printable(font, "Sipho  Zola")).toBe("Sipho Zola");
    expect(printable(font, "Ẅ")).toBe("?");
  });
  it("wraps to the width and keeps every word", async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lines = wrapLines(font, "left back overlaps and the ten drops into the pocket", 11, 90);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(font.widthOfTextAtSize(l, 11)).toBeLessThanOrEqual(90);
    expect(lines.join(" ")).toBe("left back overlaps and the ten drops into the pocket");
  });
  it("reads hex colours and falls back to ink", () => {
    expect(hexColor("#ff0000")).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 });
    expect(hexColor("red")).toEqual({ type: "RGB", red: 0.1, green: 0.1, blue: 0.12 });
  });
  it("names the file after the play", () => {
    expect(handoutFileName("High Press!", "U13")).toBe("high-press-handout.pdf");
    expect(handoutFileName("", "U13 Lions")).toBe("u13-lions-handout.pdf");
    expect(handoutFileName(null, null)).toBe("play-handout.pdf");
  });
});

// A one-page handout of a play, to print or send on WhatsApp.
//
// Positions and first names only: the tokens already carry a first name or a
// shirt number, and nothing else about a child (surname, id, photo, notes)
// is ever passed in. The coach's own instruction lines are printed as typed.
//
// Drawn straight onto the page with pdf-lib, in board units (100 wide x 150
// tall, the home team attacking up), so what prints is the board the coach
// sees. Pure of the DOM: it returns the PDF bytes.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  ARROW_SHAPE_KINDS, BOARD_H, BOARD_W, GROUP_COLOR, shapeColor, shapeWidth, type Shape, type Token,
} from "@/lib/board-model";

const PAGE_W = 595; // A4 portrait, points
const PAGE_H = 842;
const MARGIN = 40;
const PITCH_W = 380;
const SCALE = PITCH_W / BOARD_W; // points per board unit
const PITCH_H = BOARD_H * SCALE;
const PITCH_X = (PAGE_W - PITCH_W) / 2;
const PITCH_TOP = PAGE_H - 108; // y of the pitch's top edge

export interface HandoutInput {
  title: string;
  /** Team and age group, or the academy. */
  subtitle: string;
  tokens: Pick<Token, "label" | "x" | "y" | "kind" | "group">[];
  shapes: Shape[];
  /** What the coach told the board, as typed. */
  instructions: string[];
  /** Printed under the subtitle, e.g. "4 October 2026". */
  dateLabel?: string;
}

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.44);
const WHITE = rgb(1, 1, 1);

/** "#rrggbb" to a pdf-lib colour; anything else is ink. */
export function hexColor(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return INK;
  const n = Number.parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** The text with anything the standard fonts cannot print swapped for "?",
 * so a name with an unusual letter never stops the file being made. */
export function printable(font: PDFFont, text: string): string {
  return [...text.replace(/\s+/g, " ")]
    .map((c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    })
    .join("");
}

/** Break `text` into lines no wider than `maxWidth` at `size`. A single word
 * wider than the line is left whole rather than cut. */
export function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of printable(font, text).split(" ").filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Board unit to page point.
const px = (x: number) => PITCH_X + x * SCALE;
const py = (y: number) => PITCH_TOP - y * SCALE;

function line(page: PDFPage, a: { x: number; y: number }, b: { x: number; y: number }, thickness = 1.2, color = WHITE) {
  page.drawLine({ start: { x: px(a.x), y: py(a.y) }, end: { x: px(b.x), y: py(b.y) }, thickness, color, opacity: 0.9 });
}

function box(page: PDFPage, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x: px(x), y: py(y + h), width: w * SCALE, height: h * SCALE, borderColor: WHITE, borderWidth: 1.2, opacity: 0.9, borderOpacity: 0.9 });
}

function drawPitch(page: PDFPage) {
  page.drawRectangle({ x: PITCH_X, y: PITCH_TOP - PITCH_H, width: PITCH_W, height: PITCH_H, color: rgb(0.12, 0.54, 0.27) });
  // Mown stripes, ten bands, every other one a shade darker.
  const band = BOARD_H / 10;
  for (let i = 0; i < 10; i += 2) {
    page.drawRectangle({ x: PITCH_X, y: py((i + 1) * band), width: PITCH_W, height: band * SCALE, color: rgb(0.09, 0.48, 0.23) });
  }
  box(page, 2, 2, BOARD_W - 4, BOARD_H - 4);
  line(page, { x: 2, y: BOARD_H / 2 }, { x: BOARD_W - 2, y: BOARD_H / 2 });
  page.drawCircle({ x: px(BOARD_W / 2), y: py(BOARD_H / 2), size: 13.5 * SCALE, borderColor: WHITE, borderWidth: 1.2, borderOpacity: 0.9 });
  // Penalty areas (59 x 24 units) and goal areas (27 x 8) at both ends.
  box(page, (BOARD_W - 59) / 2, 2, 59, 24);
  box(page, (BOARD_W - 27) / 2, 2, 27, 8);
  box(page, (BOARD_W - 59) / 2, BOARD_H - 26, 59, 24);
  box(page, (BOARD_W - 27) / 2, BOARD_H - 10, 27, 8);
}

function arrow(page: PDFPage, sh: Shape) {
  const a = sh.pts[0];
  const b = sh.pts[sh.pts.length - 1];
  const color = hexColor(shapeColor(sh));
  const thickness = Math.max(1.4, shapeWidth(sh) * SCALE * 0.55);
  const dashed = sh.kind === "pass";
  page.drawLine({
    start: { x: px(a.x), y: py(a.y) },
    end: { x: px(b.x), y: py(b.y) },
    thickness,
    color,
    ...(dashed ? { dashArray: [6, 4] } : {}),
  });
  const ang = Math.atan2(py(b.y) - py(a.y), px(b.x) - px(a.x));
  const head = 9;
  for (const side of [-1, 1]) {
    page.drawLine({
      start: { x: px(b.x), y: py(b.y) },
      end: { x: px(b.x) - head * Math.cos(ang + side * 0.45), y: py(b.y) - head * Math.sin(ang + side * 0.45) },
      thickness,
      color,
    });
  }
}

function drawShapes(page: PDFPage, shapes: Shape[]) {
  for (const sh of shapes) {
    if (ARROW_SHAPE_KINDS.has(sh.kind) && sh.pts.length >= 2) {
      arrow(page, sh);
    } else if (sh.kind === "zone" && sh.pts.length >= 3) {
      const corners = sh.pts.map((p) => [p.x, p.y].join(" "));
      const d = ["M", corners.join(" L "), "Z"].join(" ");
      page.drawSvgPath(d, { x: px(0), y: py(0), scale: SCALE, color: hexColor(shapeColor(sh)), opacity: 0.25, borderColor: hexColor(shapeColor(sh)), borderWidth: 1 });
    } else if (sh.kind === "free" && sh.pts.length >= 2) {
      for (let i = 1; i < sh.pts.length; i++) {
        line(page, sh.pts[i - 1], sh.pts[i], 1.6, hexColor(shapeColor(sh)));
      }
    }
  }
}

function badge(label: string): string {
  const t = label.trim();
  if (!t) return "";
  return /^\d{1,2}$/.test(t) ? t : t[0].toUpperCase();
}

function tokenFill(tok: HandoutInput["tokens"][number]): string {
  if (tok.kind === "opponent") return GROUP_COLOR.Opponent;
  if (tok.kind === "ball") return GROUP_COLOR.Ball;
  return GROUP_COLOR[tok.group] ?? GROUP_COLOR.Midfielder;
}

function drawTokens(page: PDFPage, tokens: HandoutInput["tokens"], bold: PDFFont, regular: PDFFont) {
  for (const tok of tokens) {
    const isBall = tok.kind === "ball";
    const r = (isBall ? 2.4 : 4.2) * SCALE;
    const fill = tokenFill(tok);
    page.drawCircle({ x: px(tok.x), y: py(tok.y), size: r, color: hexColor(fill), borderColor: WHITE, borderWidth: 1.4 });
    if (isBall) continue;
    const b = printable(bold, badge(tok.label));
    const size = r * 1.05;
    page.drawText(b, { x: px(tok.x) - bold.widthOfTextAtSize(b, size) / 2, y: py(tok.y) - size * 0.35, size, font: bold, color: WHITE });
    const name = printable(regular, tok.label.trim());
    if (name && !/^\d{1,2}$/.test(name)) {
      const ns = 7;
      const w = regular.widthOfTextAtSize(name, ns) + 6;
      const cy = py(tok.y) - r - 7;
      page.drawRectangle({ x: px(tok.x) - w / 2, y: cy - 3, width: w, height: 10, color: rgb(0.06, 0.09, 0.16), opacity: 0.82 });
      page.drawText(name, { x: px(tok.x) - w / 2 + 3, y: cy, size: ns, font: regular, color: WHITE });
    }
  }
}

/** Build the handout. Resolves with the PDF's bytes. */
export async function generatePlayHandoutPdf(input: HandoutInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const title = wrapLines(bold, input.title || "Play", 22, PAGE_W - 2 * MARGIN)[0] ?? "Play";
  page.drawText(title, { x: MARGIN, y: PAGE_H - 52, size: 22, font: bold, color: INK });
  const sub = [input.subtitle, input.dateLabel].filter(Boolean).join("  ·  ");
  page.drawText(printable(regular, sub), { x: MARGIN, y: PAGE_H - 72, size: 11, font: regular, color: MUTED });

  drawPitch(page);
  drawShapes(page, input.shapes);
  drawTokens(page, input.tokens, bold, regular);

  // The coach's words under the pitch.
  let y = PITCH_TOP - PITCH_H - 26;
  const instructions = input.instructions.filter((s) => s.trim() !== "");
  if (instructions.length > 0) {
    page.drawText("Coach's instructions", { x: MARGIN, y, size: 12, font: bold, color: INK });
    y -= 17;
    for (const text of instructions) {
      for (const [i, ln] of wrapLines(regular, text, 11, PAGE_W - 2 * MARGIN - 14).entries()) {
        if (y < 60) break;
        if (i === 0) page.drawText("•", { x: MARGIN, y, size: 11, font: regular, color: INK });
        page.drawText(ln, { x: MARGIN + 14, y, size: 11, font: regular, color: INK });
        y -= 15;
      }
    }
  }

  page.drawText("Positions and first names only.", { x: MARGIN, y: 30, size: 8, font: regular, color: MUTED });
  const brand = "Growfit";
  page.drawText(brand, { x: PAGE_W - MARGIN - bold.widthOfTextAtSize(brand, 9), y: 30, size: 9, font: bold, color: MUTED });

  return pdf.save();
}

/** "High Press!" becomes "high-press-handout.pdf". Falls back to the team, then "play". */
export function handoutFileName(playName: string | null | undefined, teamName: string | null | undefined): string {
  const slug = (v: string | null | undefined) => (v ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join("-");
  const base = [playName, teamName].map(slug).find((v) => v.length > 0) ?? "play";
  return `${base.slice(0, 50)}-handout.pdf`;
}

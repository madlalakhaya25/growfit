import {
  PDFDocument,
  StandardFonts,
  rgb,
  rectangle,
  clip,
  endPath,
  pushGraphicsState,
  popGraphicsState,
} from "pdf-lib";
import QRCode from "qrcode";
import { getInitials } from "@/lib/player";

/**
 * Generates a printable player registration card that mirrors the layout of
 * the real SAFA/MySAFA cards this app already reads on import (landscape,
 * photo + info block on a colour band, name/role/FIFA number + QR on a white
 * band below) — used for a player whose registration is genuine and already
 * verified (entered by an admin bound to the academy's rules and contract)
 * but who has no card PDF on file yet.
 *
 * The one deliberate substitution: where the real card carries SAFA's own
 * crest and a QR into SAFA's verification system (something this app has no
 * access to), this card carries Growfit's crest and a QR into the player's
 * real Growfit passport page instead — everything else about the layout is
 * matched so the two are interchangeable at a glance.
 */

const W = 600;
const H = 234;
const TOP_H = 150; // colour band
const BAND = rgb(0.4, 0.44, 0.58); // steel-blue, matching the reference card
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.44);

export interface PlayerCardData {
  fullName: string;
  dateOfBirth: string | null; // YYYY-MM-DD
  ageGroup: string | null;
  mysafaNumber: string | null;
  fifaNumber: string | null;
  academyName: string;
  academyLocation: string | null;
  passportUrl: string;
  season: string;
}

export async function generatePlayerCardPdf(
  data: PlayerCardData,
  assets: { logoPng: Uint8Array; photo: { bytes: Uint8Array; kind: "jpg" | "png" } | null }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([W, H]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const logo = await pdf.embedPng(assets.logoPng);

  // Colour band
  page.drawRectangle({ x: 0, y: H - TOP_H, width: W, height: TOP_H, color: BAND });

  // Faint season watermark, upper right of the colour band
  const watermarkSize = 64;
  page.drawText(data.season, {
    x: W - regular.widthOfTextAtSize(data.season, watermarkSize) - 20,
    y: H - 58,
    size: watermarkSize,
    font: bold,
    color: WHITE,
    opacity: 0.12,
  });

  // Photo, left edge of the colour band
  const photoW = 104, photoH = 130;
  const photoX = 10, photoY = H - TOP_H + (TOP_H - photoH) / 2;
  page.drawRectangle({
    x: photoX - 2, y: photoY - 2, width: photoW + 4, height: photoH + 4,
    color: rgb(0.96, 0.96, 0.97),
  });
  if (assets.photo) {
    const img = assets.photo.kind === "jpg" ? await pdf.embedJpg(assets.photo.bytes) : await pdf.embedPng(assets.photo.bytes);
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const drawW = img.width * scale, drawH = img.height * scale;
    page.pushOperators(pushGraphicsState(), rectangle(photoX, photoY, photoW, photoH), clip(), endPath());
    page.drawImage(img, {
      x: photoX - (drawW - photoW) / 2,
      y: photoY - (drawH - photoH) / 2,
      width: drawW, height: drawH,
    });
    page.pushOperators(popGraphicsState());
  } else {
    const initials = getInitials(data.fullName);
    page.drawText(initials, {
      x: photoX + photoW / 2 - bold.widthOfTextAtSize(initials, 28) / 2,
      y: photoY + photoH / 2 - 10, size: 28, font: bold, color: rgb(0.6, 0.62, 0.72),
    });
  }

  // Info block, right of the photo
  const tx = photoX + photoW + 16;
  let ty = H - 24;
  if (data.ageGroup) {
    page.drawText(data.ageGroup, { x: tx, y: ty, size: 14, font: bold, color: WHITE });
    ty -= 17;
  }
  const issueDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, matching MySAFA's own export format
  page.drawText(issueDate, { x: tx, y: ty, size: 9, font: regular, color: rgb(0.92, 0.93, 0.97) });
  ty -= 13;
  page.drawText("SAFA Ethekwini ( KZN )", { x: tx, y: ty, size: 9, font: regular, color: rgb(0.92, 0.93, 0.97) });
  ty -= 13;
  if (data.academyLocation) {
    page.drawText(data.academyLocation, { x: tx, y: ty, size: 9, font: regular, color: rgb(0.92, 0.93, 0.97) });
    ty -= 13;
  }
  page.drawText(data.academyName, { x: tx, y: ty, size: 9, font: regular, color: rgb(0.92, 0.93, 0.97) });
  ty -= 24;
  page.drawText("MYSAFA", { x: tx, y: ty, size: 9, font: bold, color: WHITE });
  page.drawText(data.mysafaNumber ?? "—", { x: tx + 46, y: ty, size: 9, font: bold, color: WHITE });
  ty -= 14;
  const dobLabel = data.dateOfBirth
    ? new Date(data.dateOfBirth).toLocaleDateString("en-ZA", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  page.drawText(`dob: ${dobLabel}`, { x: tx, y: ty, size: 9, font: regular, color: rgb(0.92, 0.93, 0.97) });

  // White identity band
  const nameParts = data.fullName.trim().split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
  const givenName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";

  let by = H - TOP_H - 16;
  page.drawText(surname.toUpperCase(), { x: 16, y: by, size: 14, font: bold, color: INK });
  if (givenName) {
    by -= 15;
    page.drawText(givenName, { x: 16, y: by, size: 11, font: regular, color: INK });
  }
  by -= 18;
  const pillLabel = "Player";
  const pillW = bold.widthOfTextAtSize(pillLabel, 8) + 16;
  page.drawRectangle({ x: 16, y: by - 3, width: pillW, height: 14, color: INK });
  page.drawText(pillLabel, { x: 16 + 8, y: by, size: 8, font: bold, color: WHITE });
  if (data.fifaNumber) {
    by -= 17;
    page.drawText("FIFA", { x: 16, y: by, size: 9, font: bold, color: rgb(0.05, 0.28, 0.68) });
    page.drawText(data.fifaNumber, { x: 16 + bold.widthOfTextAtSize("FIFA", 9) + 6, y: by, size: 9, font: bold, color: INK });
  }

  // QR, pointing at the player's real Growfit passport rather than SAFA's own verification system
  const qrPngDataUrl = await QRCode.toDataURL(data.passportUrl, { width: 200, margin: 0 });
  const qrBytes = Buffer.from(qrPngDataUrl.split(",")[1], "base64");
  const qrImg = await pdf.embedPng(qrBytes);
  const qrSize = 50;
  page.drawImage(qrImg, { x: W / 2 - 20, y: (H - TOP_H - qrSize) / 2, width: qrSize, height: qrSize });

  // Growfit crest + name, standing in for SAFA's own federation mark
  const crestSize = 32;
  const crestX = W - 150;
  page.drawImage(logo, { x: crestX, y: (H - TOP_H) / 2 - crestSize / 2, width: crestSize, height: crestSize });
  page.drawText("GROWFIT SPORT", { x: crestX + crestSize + 8, y: (H - TOP_H) / 2 + 6, size: 8, font: bold, color: INK });
  page.drawText("ACADEMY", { x: crestX + crestSize + 8, y: (H - TOP_H) / 2 - 5, size: 8, font: bold, color: INK });
  page.drawText("Registration verified with SAFA", { x: crestX + crestSize + 8, y: (H - TOP_H) / 2 - 16, size: 6, font: regular, color: MUTED });

  return pdf.save();
}

import { PDFDocument, PDFName } from "pdf-lib";

/**
 * Pull embedded headshots out of a SAFA registration PDF, one slot per card
 * in true on-page order (left to right, top to bottom) — the same order the
 * text extraction is asked to read the cards in, so the two lists can be
 * paired by position.
 *
 * These cards are generated, not scanned: every graphic on the page — the
 * academy crest, a QR code, a badge, the player's photo — is its own embedded
 * image object. That means a real photo can be read out directly, with no
 * OCR and no rendering the page to a bitmap for the actual pixels.
 *
 * Getting the ORDER right, though, turned out to need a real PDF
 * interpreter, not a hand-rolled one — verified against a real, messy
 * Growfit card sheet:
 *
 * - A resource dictionary's key order (an earlier version of this file) is
 *   just whatever order the generator happened to write resource names in,
 *   and did not match the cards' visual grid position.
 * - The content stream's own "Do" paint sequence — plausible-sounding, since
 *   it's literally paint order — ALSO did not match visual order on that
 *   same sheet: two cards' Form XObjects were invoked out of grid order.
 * - Reliably resolving a card's true on-page position requires composing
 *   nested Form transforms and BBoxes correctly, which a full interpreter
 *   does and a hand-rolled content-stream walk kept getting subtly wrong.
 *
 * So this uses pdf.js (`collectImageCandidates`, via `getOperatorList`) to
 * get each image's correctly-resolved page position, and sorts by that —
 * top-to-bottom row clusters, left-to-right within a row — rather than by
 * any form of document-internal ordering. pdf-lib is still used for the
 * actual photo bytes (`extractJpegBytesByDimension`): pdf.js gives correct
 * positions but decodes to raw pixels, and re-encoding would degrade the
 * photo, so pdf-lib reads the original JPEG bytes and the two are joined by
 * each photo's pixel dimensions.
 *
 * Two more things this guards against, both seen on that same real sheet:
 *
 * - A missing photo (blank slot, or one that didn't survive editing) must
 *   not shift every photo after it onto the wrong player. A slot with no
 *   usable photo becomes `null` and keeps its position in the grid — column
 *   position is inferred from whichever row has the most photos, so a card
 *   missing its photo in an otherwise-full row doesn't collapse the row and
 *   shift its neighbour into the gap.
 * - A hand-edited card had two images placed on top of each other in the
 *   same slot (old photo left behind under the replacement) — no way to
 *   tell which is real from the file alone, so overlapping placements are
 *   dropped as a pair rather than guessing. A child's face is not something
 *   to guess at; losing one auto-match is a far smaller cost than showing
 *   the wrong one confidently.
 */

const MIN_DIMENSION = 100;
// Excludes small shared decorations (badges, QR mounts) reused across
// cards — a real per-card photo is both larger on the page and, unlike a
// shared graphic, painted at exactly one position in the whole document.
const MIN_ONPAGE_SIZE = 60;
// Two placements this close (in points) are treated as competing for the
// same slot rather than two different cards.
const COLLISION_DISTANCE = 40;
const ROW_CLUSTER_FACTOR = 0.6;

type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
function mul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

interface ImageCandidate {
  page: number;
  w: number; // native pixel width
  h: number; // native pixel height
  x: number; // page position, PDF user space
  y: number;
  onPageW: number; // displayed size in points
  onPageH: number;
}

async function collectImageCandidates(bytes: Buffer): Promise<ImageCandidate[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
  }).promise;
  const OPS = pdfjsLib.OPS;

  const raw: (ImageCandidate & { id: string })[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opList: any = await page.getOperatorList();
    let ctm: Mat = IDENTITY;
    const stack: Mat[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.save) { stack.push(ctm); continue; }
      if (fn === OPS.restore) { ctm = stack.pop() ?? IDENTITY; continue; }
      if (fn === OPS.transform) { ctm = mul(args as Mat, ctm); continue; }
      if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        const [id, w, h] = args as [string, number, number];
        if (typeof w !== "number" || typeof h !== "number") continue;
        raw.push({
          page: p, id, w, h,
          x: ctm[4], y: ctm[5],
          onPageW: Math.abs(ctm[0]), onPageH: Math.abs(ctm[3]),
        });
      }
    }
  }

  // A shared graphic (crest, QR mount) is the same object painted at
  // several different positions; a per-card photo is painted once.
  const idCounts = new Map<string, number>();
  for (const r of raw) {
    const key = `${r.page}:${r.id}`;
    idCounts.set(key, (idCounts.get(key) ?? 0) + 1);
  }

  return raw.filter((r) =>
    idCounts.get(`${r.page}:${r.id}`) === 1 &&
    r.w >= MIN_DIMENSION && r.h >= MIN_DIMENSION &&
    r.onPageW >= MIN_ONPAGE_SIZE && r.onPageH >= MIN_ONPAGE_SIZE
  );
}

/** Reading order: top-to-bottom rows, left-to-right within a row. */
function orderIntoSlots(candidates: ImageCandidate[]): (ImageCandidate | null)[] {
  const byPage = new Map<number, ImageCandidate[]>();
  for (const c of candidates) {
    if (!byPage.has(c.page)) byPage.set(c.page, []);
    byPage.get(c.page)!.push(c);
  }

  const slots: (ImageCandidate | null)[] = [];
  for (const p of [...byPage.keys()].sort((a, b) => a - b)) {
    let list = byPage.get(p)!;

    // Collapse overlapping placements (the same slot, twice) — drop both
    // rather than guess which is real. See file header.
    const used = new Set<number>();
    const collapsed: ImageCandidate[] = [];
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      const cluster = [i];
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(list[i].x - list[j].x) < COLLISION_DISTANCE && Math.abs(list[i].y - list[j].y) < COLLISION_DISTANCE) {
          cluster.push(j);
        }
      }
      cluster.forEach((k) => used.add(k));
      if (cluster.length === 1) collapsed.push(list[i]);
    }
    list = collapsed;

    // Row-cluster by vertical center, top of page first.
    const withCenter = list.map((it) => ({ it, cy: it.y + it.onPageH / 2 }));
    withCenter.sort((a, b) => b.cy - a.cy);
    const rows: { cy: number; items: typeof withCenter }[] = [];
    for (const entry of withCenter) {
      const last = rows[rows.length - 1];
      const threshold = entry.it.onPageH * ROW_CLUSTER_FACTOR;
      if (last && Math.abs(entry.cy - last.cy) < threshold) last.items.push(entry);
      else rows.push({ cy: entry.cy, items: [entry] });
    }

    // The fullest row establishes the grid's column positions, so a row
    // missing one photo still places its survivor(s) in the right column
    // instead of shifting them left.
    const fullestRow = rows.reduce<{ cy: number; items: typeof withCenter } | null>(
      (a, b) => (!a || b.items.length > a.items.length ? b : a),
      null
    );
    const columnXs = (fullestRow?.items ?? []).map((e) => e.it.x).sort((a, b) => a - b);

    for (const row of rows) {
      row.items.sort((a, b) => a.it.x - b.it.x);
      if (columnXs.length <= 1 || row.items.length >= columnXs.length) {
        for (const e of row.items) slots.push(e.it);
        continue;
      }
      const placed: (ImageCandidate | null)[] = columnXs.map(() => null);
      for (const e of row.items) {
        let best = 0, bestDist = Infinity;
        for (let c = 0; c < columnXs.length; c++) {
          const d = Math.abs(columnXs[c] - e.it.x);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        placed[best] = e.it;
      }
      slots.push(...placed);
    }
  }
  return slots;
}

/**
 * Every JPEG (`DCTDecode`) image on the page, grouped by native pixel
 * dimensions. Restricted to JPEG specifically: everything else on these
 * cards — crest, QR code, badges, and (seen on a real hand-edited card) a
 * corrupted placeholder the right size and shape to look like a photo — is
 * a raw Flate bitmap. JPEG-only trades a rare miss for never attaching a
 * broken or wrong image.
 */
async function extractJpegBytesByDimension(bytes: Buffer): Promise<Map<string, string[]>> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pool = new Map<string, string[]>();
  const seenRefs = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(resources: any, depth: number) {
    if (depth > 8 || !resources) return;
    const xobjDict = resources.lookup?.(PDFName.of("XObject"));
    if (!xobjDict) return;
    for (const key of xobjDict.keys()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ref: any, obj: any;
      try {
        ref = xobjDict.get(key);
        obj = xobjDict.lookup(key);
      } catch {
        continue;
      }
      if (!obj?.dict) continue;
      const dict = obj.dict;
      const subtype = dict.get?.(PDFName.of("Subtype"))?.toString();

      if (subtype === "/Image") {
        const refKey = ref?.toString();
        if (!refKey || seenRefs.has(refKey)) continue;

        const filter = dict.get(PDFName.of("Filter"))?.toString();
        if (filter !== "/DCTDecode") continue;

        const width = Number(dict.get(PDFName.of("Width")));
        const height = Number(dict.get(PDFName.of("Height")));
        if (!width || !height || width < MIN_DIMENSION || height < MIN_DIMENSION) continue;

        const contents: Uint8Array | undefined = obj.contents;
        if (!contents) continue;

        seenRefs.add(refKey);
        const dataUrl = `data:image/jpeg;base64,${Buffer.from(contents).toString("base64")}`;
        const dimKey = `${width}x${height}`;
        const list = pool.get(dimKey);
        if (list) list.push(dataUrl);
        else pool.set(dimKey, [dataUrl]);
        continue;
      }

      if (subtype === "/Form") {
        const formResources = dict.get(PDFName.of("Resources"));
        if (!formResources) continue;
        const formResourceDict = formResources.lookup ? formResources : pdf.context.lookup(formResources);
        walk(formResourceDict, depth + 1);
      }
    }
  }

  for (const page of pdf.getPages()) walk(page.node.Resources(), 0);
  return pool;
}

/**
 * One entry per card slot found, in true reading order — `null` where a
 * slot has no usable photo, so the array stays aligned with the text
 * extraction's one-row-per-card output even when some cards are missing a
 * photo or their placement is too ambiguous to trust.
 */
export async function extractPdfHeadshots(bytes: Buffer): Promise<(string | null)[]> {
  const [candidates, pool] = await Promise.all([
    collectImageCandidates(bytes),
    extractJpegBytesByDimension(bytes),
  ]);
  const orderedSlots = orderIntoSlots(candidates);

  return orderedSlots.map((slot) => {
    if (!slot) return null;
    const list = pool.get(`${slot.w}x${slot.h}`);
    return list?.shift() ?? null;
  });
}

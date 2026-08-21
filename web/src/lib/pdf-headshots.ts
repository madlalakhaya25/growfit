import { PDFDocument, PDFName } from "pdf-lib";

/**
 * Pull embedded headshots out of a SAFA registration PDF, each tagged where
 * possible with the text printed on its own card — so a photo can be bound
 * to a player by that player's registration number rather than by position
 * in a list.
 *
 * These cards are generated, not scanned: every graphic on the page — the
 * academy crest, a QR code, a badge, the player's photo — is its own embedded
 * image object. So a real photo can be read out directly, with no OCR.
 *
 * Two rules shape this file, both learned the hard way on real documents:
 *
 * 1. NEVER pair by position. Tried and abandoned twice — a resource
 *    dictionary's key order and the content stream's own paint order each
 *    failed to match visual layout on a real sheet. Worse, ANY positional
 *    scheme breaks when one card's photo is missing or unreadable: every
 *    photo after it shifts one player up, silently putting the wrong child's
 *    face on a name. So each photo carries the text printed beneath it on
 *    its own card — which includes that player's unique FIFA Connect ID and
 *    MySAFA number — and the caller binds by matching those.
 *
 * 2. NEVER silently drop a photo. An earlier version filtered candidates by
 *    absolute on-page point sizes fitted to one sample document; a
 *    differently-scaled PDF fell outside those bounds and produced zero
 *    photos with no explanation. So pdf-lib is the authoritative source here
 *    — every embedded JPEG of plausible size is returned no matter what —
 *    and pdf.js only ADDS position and card text on top. A photo whose card
 *    could not be identified comes back with empty `labels` rather than
 *    vanishing, leaving the caller free to surface it for manual assignment.
 *    Geometry thresholds that remain are relative to the page or the image,
 *    never absolute points.
 *
 * Restricting to JPEG (`DCTDecode`) is what separates photos from the
 * crest/QR/badge graphics, which are all raw Flate bitmaps. It also excludes
 * a corrupted photo slot seen on a real hand-edited card — right size and
 * shape, but not a usable image. A child's face is not something to guess
 * at, so a miss is the right trade there.
 */

// Native pixel floor — below this it is an icon, not a portrait.
const MIN_DIMENSION = 100;
// Relative to page size, so this scales with however the document was
// generated instead of assuming one sample's point sizes.
const MIN_ONPAGE_FRACTION = 0.04; // ignore tiny decorations
const MAX_ONPAGE_AREA_FRACTION = 0.25; // ignore page/card background art
// Reach for card text, as a multiple of the photo's own on-page height.
const LABEL_REACH_FACTOR = 1.1;
const LABEL_WIDTH_FACTOR = 2.5;
// Two placements overlapping by this much of their own size are competing
// for one slot (a replacement painted over an original), not two cards.
const COLLISION_FACTOR = 0.5;
const ROW_CLUSTER_FACTOR = 0.6;

export interface CardHeadshot {
  dataUrl: string;
  /**
   * Uppercased, whitespace-stripped text tokens printed on the same card —
   * registration numbers and name parts. Empty when the photo's card could
   * not be identified, in which case the caller must not guess an owner.
   */
  labels: string[];
}

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

interface Placement {
  page: number;
  w: number; // native pixel size — the join key back to the JPEG bytes
  h: number;
  x: number;
  y: number;
  onPageW: number;
  onPageH: number;
  labels: string[];
}

/**
 * Where each photo-shaped image sits on the page, and the card text beneath
 * it. Best-effort and purely additive: anything this cannot work out simply
 * means a photo arrives without labels, never that it disappears.
 *
 * pdf.js is used rather than a hand-rolled content-stream walk because
 * resolving a placement's true page position means composing nested Form
 * XObject transforms, which a hand-rolled version kept getting subtly wrong.
 */
async function collectPlacements(bytes: Buffer): Promise<Placement[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
  }).promise;
  const OPS = pdfjsLib.OPS;

  const out: Placement[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const pageW = viewport.width || 1;
    const pageH = viewport.height || 1;
    const pageArea = pageW * pageH;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opList: any = await page.getOperatorList();

    let ctm: Mat = IDENTITY;
    const stack: Mat[] = [];
    const placements: Omit<Placement, "labels">[] = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.save) { stack.push(ctm); continue; }
      if (fn === OPS.restore) { ctm = stack.pop() ?? IDENTITY; continue; }
      if (fn === OPS.transform) { ctm = mul(args as Mat, ctm); continue; }
      if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        const [, w, h] = args as [string, number, number];
        if (typeof w !== "number" || typeof h !== "number") continue;
        const onPageW = Math.abs(ctm[0]);
        const onPageH = Math.abs(ctm[3]);
        if (w < MIN_DIMENSION || h < MIN_DIMENSION) continue;
        if (onPageW < pageW * MIN_ONPAGE_FRACTION) continue;
        if (onPageH < pageH * MIN_ONPAGE_FRACTION) continue;
        if (onPageW * onPageH > pageArea * MAX_ONPAGE_AREA_FRACTION) continue;
        placements.push({ page: p, w, h, x: ctm[4], y: ctm[5], onPageW, onPageH });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textContent: any = await page.getTextContent();
    const texts = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((it: any) => typeof it.str === "string" && it.str.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((it: any) => ({ s: it.str.trim(), x: it.transform[4], y: it.transform[5] }));

    for (const pl of placements) {
      const reach = pl.onPageH * LABEL_REACH_FACTOR;
      const width = pl.onPageW * LABEL_WIDTH_FACTOR;
      const labels = texts
        .filter((t: { x: number; y: number }) =>
          t.x + 5 >= pl.x - pl.onPageW * 0.4 &&
          t.x <= pl.x + width &&
          t.y < pl.y &&
          t.y > pl.y - reach
        )
        .map((t: { s: string }) => t.s.replace(/\s/g, "").toUpperCase())
        .filter((s: string) => s.length > 0);
      out.push({ ...pl, labels });
    }
  }

  return out;
}

interface Jpeg { dataUrl: string; w: number; h: number }

/**
 * Every embedded JPEG of plausible portrait size, in document order. This is
 * the authoritative photo set — see rule 2 in the file header: geometry can
 * refine what we know about these, but must never remove one.
 */
async function extractJpegs(bytes: Buffer): Promise<Jpeg[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const found: Jpeg[] = [];
  const seenRefs = new Set<string>();

  // The object graph is walked ad hoc — Form XObjects nest further XObject
  // dictionaries to an unpredictable depth — so this uses loosely-typed nodes
  // by design rather than fighting pdf-lib's low-level types for a traversal
  // they are not meant to describe.
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
        if (dict.get(PDFName.of("Filter"))?.toString() !== "/DCTDecode") continue;

        const w = Number(dict.get(PDFName.of("Width")));
        const h = Number(dict.get(PDFName.of("Height")));
        if (!w || !h || w < MIN_DIMENSION || h < MIN_DIMENSION) continue;

        const contents: Uint8Array | undefined = obj.contents;
        if (!contents) continue;

        seenRefs.add(refKey);
        found.push({ w, h, dataUrl: `data:image/jpeg;base64,${Buffer.from(contents).toString("base64")}` });
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
  return found;
}

/** Reading order: pages, then top-to-bottom rows, left-to-right within a row. */
function toReadingOrder<T extends { page: number; x: number; y: number; onPageH: number }>(items: T[]): T[] {
  const ordered: T[] = [];
  const byPage = new Map<number, T[]>();
  for (const it of items) {
    if (!byPage.has(it.page)) byPage.set(it.page, []);
    byPage.get(it.page)!.push(it);
  }
  for (const p of [...byPage.keys()].sort((a, b) => a - b)) {
    const withCenter = byPage.get(p)!.map((it) => ({ it, cy: it.y + it.onPageH / 2 }));
    withCenter.sort((a, b) => b.cy - a.cy);
    const rows: { cy: number; items: typeof withCenter }[] = [];
    for (const entry of withCenter) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(entry.cy - last.cy) < entry.it.onPageH * ROW_CLUSTER_FACTOR) last.items.push(entry);
      else rows.push({ cy: entry.cy, items: [entry] });
    }
    for (const row of rows) {
      row.items.sort((a, b) => a.it.x - b.it.x);
      for (const e of row.items) ordered.push(e.it);
    }
  }
  return ordered;
}

/**
 * Every card photo found. Those whose card could be identified carry that
 * card's text in `labels` and come first, in reading order; any photo whose
 * placement could not be resolved still appears, with empty labels, so the
 * caller can offer it for manual assignment rather than losing it.
 */
export async function extractPdfHeadshots(bytes: Buffer): Promise<CardHeadshot[]> {
  const jpegs = await extractJpegs(bytes);
  if (jpegs.length === 0) return [];

  // Positions and card text are a best-effort enrichment: if pdf.js cannot
  // read this document at all, every photo still comes back unlabelled.
  let placements: Placement[] = [];
  try {
    placements = await collectPlacements(bytes);
  } catch {
    placements = [];
  }

  // Join placements to their original bytes on native pixel dimensions.
  const byDimension = new Map<string, Jpeg[]>();
  for (const j of jpegs) {
    const k = `${j.w}x${j.h}`;
    const list = byDimension.get(k);
    if (list) list.push(j);
    else byDimension.set(k, [j]);
  }

  const claimed = new Set<Jpeg>();
  const located: (Placement & { jpeg: Jpeg })[] = [];
  for (const pl of placements) {
    const candidate = byDimension.get(`${pl.w}x${pl.h}`)?.find((j) => !claimed.has(j));
    if (!candidate) continue;
    claimed.add(candidate);
    located.push({ ...pl, jpeg: candidate });
  }

  // Where a replacement was painted over an original, keep the one actually
  // visible — the one painted last. `placements` is in paint order.
  const resolved: (Placement & { jpeg: Jpeg })[] = [];
  for (const cur of located) {
    const near = (a: number, b: number, size: number) => Math.abs(a - b) < size * COLLISION_FACTOR;
    const clashIdx = resolved.findIndex(
      (r) =>
        r.page === cur.page &&
        near(r.x, cur.x, Math.max(r.onPageW, cur.onPageW)) &&
        near(r.y, cur.y, Math.max(r.onPageH, cur.onPageH))
    );
    if (clashIdx === -1) resolved.push(cur);
    else {
      claimed.delete(resolved[clashIdx].jpeg);
      resolved[clashIdx] = cur;
    }
  }

  const out: CardHeadshot[] = toReadingOrder(resolved).map((r) => ({
    dataUrl: r.jpeg.dataUrl,
    labels: r.labels,
  }));

  // Anything geometry could not account for is still a real photo — see rule
  // 2 in the file header. Surfaced unlabelled rather than dropped.
  for (const j of jpegs) {
    if (!claimed.has(j)) out.push({ dataUrl: j.dataUrl, labels: [] });
  }

  return out;
}

import { PDFDocument, PDFName } from "pdf-lib";

/**
 * Pull embedded headshots out of a SAFA registration PDF, each tagged with
 * the text printed on its own card — so a photo can be bound to a player by
 * that player's registration number rather than by position in a list.
 *
 * These cards are generated, not scanned: every graphic on the page — the
 * academy crest, a QR code, a badge, the player's photo — is its own embedded
 * image object. So a real photo can be read out directly, with no OCR.
 *
 * Getting the OWNER of each photo right is the hard part, and position-based
 * pairing was tried and abandoned twice against a real Growfit card sheet:
 *
 * - A resource dictionary's key order is just whatever order the generator
 *   wrote resource names in; it did not match the cards' visual layout.
 * - The content stream's own "Do" paint order — plausible, since it is
 *   literally paint order — ALSO did not match visual layout on that sheet.
 * - Even with correct on-page geometry, ANY purely positional scheme breaks
 *   the moment one card's photo is missing or unreadable: every photo after
 *   it shifts one player up, so a single bad card silently mislabels the
 *   whole rest of the sheet. That is the worst possible failure here — a
 *   wrong child's face attached to a name, looking entirely correct.
 *
 * So position is used only to work out which card a photo sits on, never
 * which player it belongs to. Each photo is tagged with the text tokens
 * printed directly beneath it on that same card — which always include that
 * player's FIFA Connect ID and MySAFA number, both unique — and the caller
 * binds photo to player by matching those. Ordering the list correctly is
 * then merely a nicety, not a correctness requirement.
 *
 * Two more real-document hazards this handles:
 *
 * - A hand-edited card had a replacement photo painted directly over the
 *   original, leaving both in the file at the same spot. The one actually
 *   visible is the one painted last, so later paint wins.
 * - Another card's photo was a raw Flate bitmap, not a JPEG — the right
 *   size and shape to look like a photo, but not a usable one. Restricting
 *   to JPEG (`DCTDecode`) excludes it, and excludes the crest/QR/badge
 *   graphics for free. A child's face is not something to guess at, so a
 *   miss is the right trade.
 */

const MIN_DIMENSION = 100;
// On-page size bounds for a card photo, in points. The lower bound drops
// small shared decorations (badges, QR mounts); the upper bound drops the
// full-page background image, which would otherwise sit "above" every card's
// text and collect all of it as labels.
const MIN_ONPAGE_SIZE = 60;
const MAX_ONPAGE_SIZE = 200;
// How far below a photo to read text for that card's labels.
const LABEL_REACH_BELOW = 95;
// Two placements this close (points) are competing for one slot, not two cards.
const COLLISION_DISTANCE = 40;
const ROW_CLUSTER_FACTOR = 0.6;

export interface CardHeadshot {
  dataUrl: string;
  /**
   * Uppercased, whitespace-stripped text tokens printed on the same card —
   * registration numbers and name parts. The caller matches against these
   * rather than trusting this list's order.
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
  w: number; // native pixel size, used to join to the original JPEG bytes
  h: number;
  x: number; // page position, PDF user space
  y: number;
  onPageW: number;
  onPageH: number;
  labels: string[];
}

/**
 * Every photo-shaped image placement, with the card text beneath it.
 *
 * pdf.js is used here rather than a hand-rolled content-stream walk because
 * resolving a placement's true page position means composing nested Form
 * XObject transforms, which a hand-rolled version kept getting subtly wrong.
 * It decodes images to raw pixels though, and re-encoding would degrade the
 * photo, so the original JPEG bytes come from pdf-lib and the two are joined
 * on native pixel dimensions.
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
        if (onPageW < MIN_ONPAGE_SIZE || onPageH < MIN_ONPAGE_SIZE) continue;
        if (onPageW > MAX_ONPAGE_SIZE || onPageH > MAX_ONPAGE_SIZE) continue;
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
      const labels = texts
        .filter((t: { x: number; y: number }) =>
          t.x + 5 >= pl.x - 30 &&
          t.x <= pl.x + Math.max(pl.onPageW, 200) &&
          t.y < pl.y &&
          t.y > pl.y - LABEL_REACH_BELOW
        )
        .map((t: { s: string }) => t.s.replace(/\s/g, "").toUpperCase())
        .filter((s: string) => s.length > 0);
      out.push({ ...pl, labels });
    }
  }

  return out;
}

/**
 * Original JPEG bytes for every `DCTDecode` image, grouped by native pixel
 * dimensions — the join key back to the pdf.js placements.
 */
async function extractJpegBytesByDimension(bytes: Buffer): Promise<Map<string, string[]>> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pool = new Map<string, string[]>();
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

        const width = Number(dict.get(PDFName.of("Width")));
        const height = Number(dict.get(PDFName.of("Height")));
        if (!width || !height || width < MIN_DIMENSION || height < MIN_DIMENSION) continue;

        const contents: Uint8Array | undefined = obj.contents;
        if (!contents) continue;

        seenRefs.add(refKey);
        const dimKey = `${width}x${height}`;
        const dataUrl = `data:image/jpeg;base64,${Buffer.from(contents).toString("base64")}`;
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
 * One entry per card photo that could be read, in reading order — but the
 * caller should bind these to players via `labels`, not by index. A card
 * whose photo is missing or unusable simply has no entry, which is safe
 * precisely because matching is by label rather than position.
 */
export async function extractPdfHeadshots(bytes: Buffer): Promise<CardHeadshot[]> {
  const [placements, pool] = await Promise.all([
    collectPlacements(bytes),
    extractJpegBytesByDimension(bytes),
  ]);

  // Join to original JPEG bytes. Non-JPEG placements (crest, corrupted
  // photo slots) find nothing and drop out here.
  const withPhotos: (Placement & { dataUrl: string })[] = [];
  for (const pl of placements) {
    const dataUrl = pool.get(`${pl.w}x${pl.h}`)?.shift();
    if (dataUrl) withPhotos.push({ ...pl, dataUrl });
  }

  // Where a replacement was painted over an original, keep the one actually
  // visible — the one painted last. `placements` is in paint order.
  const resolved: (Placement & { dataUrl: string })[] = [];
  for (const cur of withPhotos) {
    const clashIdx = resolved.findIndex(
      (r) =>
        r.page === cur.page &&
        Math.abs(r.x - cur.x) < COLLISION_DISTANCE &&
        Math.abs(r.y - cur.y) < COLLISION_DISTANCE
    );
    if (clashIdx === -1) resolved.push(cur);
    else resolved[clashIdx] = cur;
  }

  return toReadingOrder(resolved).map((r) => ({ dataUrl: r.dataUrl, labels: r.labels }));
}

import { PDFDocument, PDFName } from "pdf-lib";

/**
 * Pull embedded headshots out of a SAFA registration PDF.
 *
 * These cards are generated, not scanned: every graphic on the page — the
 * academy crest, a QR code, a badge, the player's photo — is its own embedded
 * image object rather than one flattened page picture. That means a real photo
 * can be read out directly, with no OCR and no rendering the page to a bitmap.
 *
 * Verified against a real Growfit card sheet: walking the page's XObject tree
 * and deduplicating by the underlying PDF object reference (shared graphics
 * like the crest are the same reference reused several times, so deduping
 * naturally drops them without needing to name them) turned up exactly one
 * distinct image per card, at sizes matching a portrait headshot.
 *
 * Restricted to JPEG (`DCTDecode`) images specifically. Everything else on
 * these cards — crest, QR code, badges — is a raw Flate bitmap, so requiring
 * JPEG already excludes them without extra rules. It also turned out to matter
 * for a different reason: a corrupted or hand-edited card can carry a raw
 * bitmap that LOOKS the right size and shape but is not a usable photo, and a
 * child's face is not something to guess at. JPEG-only trades a rare miss for
 * never attaching a wrong or broken image.
 *
 * The PDF object graph here is walked ad hoc (Form XObjects nesting further
 * XObject dictionaries to an unpredictable depth) rather than through a fixed
 * shape, so this works with loosely-typed nodes by design rather than fighting
 * pdf-lib's low-level types for a traversal they are not meant to describe.
 */

const MIN_DIMENSION = 100;

export interface PdfHeadshot {
  /** Order encountered walking the page — a best-effort proxy for reading order. */
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

export async function extractPdfHeadshots(bytes: Buffer): Promise<PdfHeadshot[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const seen = new Map<string, { width: number; height: number; jpegBytes: Uint8Array }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(dict: any, ref: any, obj: any, depth: number) {
    if (depth > 8 || !dict) return;
    const subtype = dict.get?.(PDFName.of("Subtype"))?.toString();

    if (subtype === "/Image") {
      const key = ref?.toString();
      if (!key || seen.has(key)) return;

      const filter = dict.get(PDFName.of("Filter"))?.toString();
      if (filter !== "/DCTDecode") return; // JPEG only — see file header.

      const width = Number(dict.get(PDFName.of("Width")));
      const height = Number(dict.get(PDFName.of("Height")));
      if (!width || !height || width < MIN_DIMENSION || height < MIN_DIMENSION) return;

      const contents: Uint8Array | undefined = obj?.contents;
      if (!contents) return;

      seen.set(key, { width, height, jpegBytes: contents });
      return;
    }

    if (subtype === "/Form") {
      const resources = dict.get(PDFName.of("Resources"));
      if (!resources) return;
      const resourceDict = resources.lookup ? resources : pdf.context.lookup(resources);
      const inner = resourceDict?.lookup?.(PDFName.of("XObject"));
      if (!inner) return;
      for (const k of inner.keys()) {
        const childRef = inner.get(k);
        const child = inner.lookup(k);
        walk(child.dict, childRef, child, depth + 1);
      }
    }
  }

  for (const page of pdf.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xobjDict = resources.lookup(PDFName.of("XObject")) as any;
    if (!xobjDict) continue;
    for (const key of xobjDict.keys()) {
      const ref = xobjDict.get(key);
      const obj = xobjDict.lookup(key);
      walk(obj.dict, ref, obj, 0);
    }
  }

  return [...seen.values()].map((v, index) => ({
    index,
    width: v.width,
    height: v.height,
    dataUrl: `data:image/jpeg;base64,${Buffer.from(v.jpegBytes).toString("base64")}`,
  }));
}

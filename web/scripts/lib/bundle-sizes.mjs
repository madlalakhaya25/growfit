// Per-route JavaScript size from a finished `next build`: reads each page's client reference manifest and sums
// the JavaScript the browser must load for that page (raw and gzipped). Shared by measure-bundle and check-budgets.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith("page_client-reference-manifest.js")) yield p;
  }
}

/** Rows of { route, files, raw, gzip } (bytes), heaviest gzipped first. `root` is the `.next` directory. */
export function measureRoutes(root) {
  const sizes = new Map();
  const sizeOf = (file) => {
    if (!sizes.has(file)) {
      const buf = readFileSync(join(root, file));
      sizes.set(file, { raw: buf.length, gzip: gzipSync(buf).length });
    }
    return sizes.get(file);
  };

  const rows = [];
  for (const manifestPath of walk(join(root, "server/app"))) {
    // The file is `globalThis.__RSC_MANIFEST["<page>"] = {json};`, so read the JSON rather than run it.
    const text = readFileSync(manifestPath, "utf8");
    for (const [, key, body] of text.matchAll(/__RSC_MANIFEST\["([^"]+)"\]\s*=\s*(\{.*\});?\s*$/gm)) {
      const entries = JSON.parse(body).entryJSFiles ?? {};
      const pageKey = Object.keys(entries).find((k) => k.endsWith("/page"));
      if (!pageKey) continue;
      const files = [...new Set(entries[pageKey])].filter((f) => f.endsWith(".js"));
      const totals = files.reduce((t, f) => ({ raw: t.raw + sizeOf(f).raw, gzip: t.gzip + sizeOf(f).gzip }), { raw: 0, gzip: 0 });
      rows.push({ route: key.replace(/\/page$/, "").replace(/\/\([^)]*\)/g, "") || "/", files: files.length, ...totals });
    }
  }
  return rows.sort((a, b) => b.gzip - a.gzip);
}

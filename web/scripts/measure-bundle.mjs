// Per-route JavaScript size from a finished `next build` (docs/FEATURE_SPECS/experience-quality.md, step 1).
// Reads each page's client reference manifest, sums the JavaScript the browser must load for that page
// (raw and gzipped), and prints a table. No dependencies. Run: `npm run build && npm run measure:bundle`.
// Options: --json prints JSON instead of a table; --top=N limits the table (default 25).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";
import vm from "node:vm";

const root = new URL("../.next/", import.meta.url).pathname;
const appDir = join(root, "server/app");
const asJson = process.argv.includes("--json");
const top = Number(process.argv.find((a) => a.startsWith("--top="))?.slice(6) ?? 25);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.endsWith("page_client-reference-manifest.js")) yield p;
  }
}

const sizes = new Map();
function sizeOf(file) {
  if (!sizes.has(file)) {
    const buf = readFileSync(join(root, file));
    sizes.set(file, { raw: buf.length, gzip: gzipSync(buf).length });
  }
  return sizes.get(file);
}

const rows = [];
for (const manifestPath of walk(appDir)) {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(manifestPath, "utf8"), sandbox);
  for (const [key, manifest] of Object.entries(sandbox.__RSC_MANIFEST ?? {})) {
    const entries = manifest.entryJSFiles ?? {};
    const pageKey = Object.keys(entries).find((k) => k.endsWith("/page"));
    if (!pageKey) continue;
    const files = [...new Set(entries[pageKey])].filter((f) => f.endsWith(".js"));
    const totals = files.reduce((t, f) => ({ raw: t.raw + sizeOf(f).raw, gzip: t.gzip + sizeOf(f).gzip }), { raw: 0, gzip: 0 });
    rows.push({ route: key.replace(/\/page$/, "").replace(/\/\([^)]*\)/g, "") || "/", files: files.length, ...totals });
  }
}
rows.sort((a, b) => b.gzip - a.gzip);

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  const median = rows.length ? rows[Math.floor(rows.length / 2)].gzip : 0;
  console.log(`${rows.length} routes. Median ${kb(median)} gzipped, heaviest ${kb(rows[0]?.gzip ?? 0)}.\n`);
  console.log("| Route | JS files | Raw | Gzipped |\n|---|---|---|---|");
  for (const r of rows.slice(0, top)) console.log(`| ${r.route} | ${r.files} | ${kb(r.raw)} | ${kb(r.gzip)} |`);
  console.log(`\n(${relative(process.cwd(), root)} from the latest build)`);
}

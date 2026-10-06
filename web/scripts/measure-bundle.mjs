// Per-route JavaScript size from a finished `next build` (docs/FEATURE_SPECS/experience-quality.md, step 1).
// Prints a table. No dependencies. Run: `npm run build && npm run measure:bundle`.
// Options: --json prints JSON instead of a table; --top=N limits the table (default 25).
import { relative } from "node:path";
import { measureRoutes } from "./lib/bundle-sizes.mjs";

const root = new URL("../.next/", import.meta.url).pathname;
const asJson = process.argv.includes("--json");
const top = Number(process.argv.find((a) => a.startsWith("--top="))?.slice(6) ?? 25);
const rows = measureRoutes(root);

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

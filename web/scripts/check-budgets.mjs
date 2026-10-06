// Fails when a route's JavaScript is over its budget. Run after `npm run build`: `npm run check:budgets`.
// Budgets live in perf-budgets.json. To make a heavy route lighter, lower its number in the same PR that
// does the work; to raise one, say why in the PR (docs/FEATURE_SPECS/experience-quality.md).
import { readFileSync } from "node:fs";
import { measureRoutes } from "./lib/bundle-sizes.mjs";
import { checkBudgets } from "./lib/budgets.mjs";

const root = new URL("../.next/", import.meta.url).pathname;
const budgets = JSON.parse(readFileSync(new URL("../perf-budgets.json", import.meta.url), "utf8"));
const rows = measureRoutes(root);
if (rows.length === 0) {
  console.error("No routes found. Run `npm run build` first.");
  process.exit(2);
}

const { failures, stale, median } = checkBudgets(rows, budgets);
console.log(`${rows.length} routes, median ${median.toFixed(0)} KB gzipped (budget ${budgets.medianGzipKb} KB).`);
for (const s of stale) console.warn(`Tidy: ${s}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} budget${failures.length === 1 ? "" : "s"} broken:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("All routes are within budget.");

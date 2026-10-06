// Performance budgets (docs/FEATURE_SPECS/experience-quality.md, step 2). Pure, so Jest can load it.
// A budget is a ceiling on the gzipped JavaScript a route loads, in KB:
//   defaultGzipKb   every route not listed under `routes`
//   routes          a route's own ceiling, for routes that are heavy today (lower it as they get lighter)
//   medianGzipKb    the middle route, so the shared base cannot creep up unnoticed

const kb = (bytes) => bytes / 1024;

/**
 * Compare measured routes ({ route, gzip } in bytes) with the budgets.
 * Returns { failures, stale, median }: failures are messages for the build to fail on;
 * stale lists listed routes that no longer exist or now fit the default, to be tidied.
 */
export function checkBudgets(rows, budgets) {
  const failures = [];
  const stale = [];
  const listed = budgets.routes ?? {};
  const byRoute = new Map(rows.map((r) => [r.route, r]));

  for (const r of rows) {
    const limit = listed[r.route] ?? budgets.defaultGzipKb;
    if (kb(r.gzip) > limit) {
      const own = listed[r.route] !== undefined ? "its own" : "the default";
      failures.push(`${r.route}: ${kb(r.gzip).toFixed(0)} KB gzipped is over ${own} budget of ${limit} KB`);
    }
  }
  for (const [route, limit] of Object.entries(listed)) {
    const row = byRoute.get(route);
    if (!row) stale.push(`${route}: listed in the budgets but no longer built`);
    else if (limit <= budgets.defaultGzipKb) stale.push(`${route}: its own budget (${limit} KB) is not above the default; remove it`);
  }

  const sorted = rows.map((r) => r.gzip).sort((a, b) => a - b);
  const median = sorted.length ? kb(sorted[Math.floor(sorted.length / 2)]) : 0;
  if (budgets.medianGzipKb !== undefined && median > budgets.medianGzipKb) {
    failures.push(`median route: ${median.toFixed(0)} KB gzipped is over the budget of ${budgets.medianGzipKb} KB`);
  }
  return { failures, stale, median };
}

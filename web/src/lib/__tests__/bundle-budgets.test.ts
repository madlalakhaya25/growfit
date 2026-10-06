/**
 * The performance budget rules. What is tested: a route over the default or over
 * its own ceiling fails, a route at the ceiling passes, the median guard fails
 * on a creeping shared base, and stale entries are reported without failing.
 */
import { checkBudgets } from "../../../scripts/lib/budgets.mjs";

const KB = 1024;
const row = (route: string, kb: number) => ({ route, gzip: kb * KB });
const budgets = { defaultGzipKb: 150, medianGzipKb: 130, routes: { "/heavy": 300 } };

it("passes when every route is at or under its ceiling", () => {
  const r = checkBudgets([row("/a", 150), row("/heavy", 300), row("/b", 100), row("/c", 100), row("/d", 100)], budgets);
  expect(r.failures).toEqual([]);
});

it("fails a route over the default, naming it", () => {
  const r = checkBudgets([row("/a", 151), row("/b", 100), row("/c", 100)], budgets);
  expect(r.failures).toEqual(["/a: 151 KB gzipped is over the default budget of 150 KB"]);
});

it("fails a listed route over its own ceiling, and holds it to that, not the default", () => {
  expect(checkBudgets([row("/heavy", 301), row("/b", 100), row("/c", 100)], budgets).failures).toEqual([
    "/heavy: 301 KB gzipped is over its own budget of 300 KB",
  ]);
  expect(checkBudgets([row("/heavy", 250), row("/b", 100), row("/c", 100)], budgets).failures).toEqual([]);
});

it("fails when the middle route creeps over the median budget", () => {
  const r = checkBudgets([row("/a", 140), row("/b", 140), row("/c", 140)], budgets);
  expect(r.failures).toEqual(["median route: 140 KB gzipped is over the budget of 130 KB"]);
});

it("reports listed routes that no longer exist or no longer need an entry, without failing", () => {
  const r = checkBudgets([row("/a", 100), row("/b", 100), row("/c", 100)], { ...budgets, routes: { "/gone": 300, "/a": 150 } });
  expect(r.failures).toEqual([]);
  expect(r.stale).toEqual(["/gone: listed in the budgets but no longer built", "/a: its own budget (150 KB) is not above the default; remove it"]);
});

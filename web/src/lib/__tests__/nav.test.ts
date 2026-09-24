import { isActiveHref } from "@/lib/nav";

// Regression test for a real, pre-existing bug found while rebuilding the
// nav into sections: a tab whose href is the role's bare dashboard root
// (e.g. "/dashboard/coach") is a *prefix* of every other tab's href in
// the same role. The old flat nav checked every item with
// `pathname === href || pathname.startsWith(href + "/")`, so visiting any
// nested coach route (e.g. "/dashboard/coach/squad") also matched
// "Overview" — both items rendered as active at once. isActiveHref fixes
// this by requiring an exact match for the root href specifically.
describe("isActiveHref", () => {
  const roleRoot = "/dashboard/coach";

  it("matches the role root only on an exact pathname", () => {
    expect(isActiveHref("/dashboard/coach", roleRoot, roleRoot)).toBe(true);
    expect(isActiveHref("/dashboard/coach/squad", roleRoot, roleRoot)).toBe(false);
  });

  it("matches a deeper href by prefix, as before", () => {
    const href = "/dashboard/coach/squad";
    expect(isActiveHref("/dashboard/coach/squad", href, roleRoot)).toBe(true);
    expect(isActiveHref("/dashboard/coach/squad/123", href, roleRoot)).toBe(true);
    expect(isActiveHref("/dashboard/coach/squad-import", href, roleRoot)).toBe(false);
  });

  it("does not match an unrelated href", () => {
    expect(isActiveHref("/dashboard/coach/fixtures", "/dashboard/coach/squad", roleRoot)).toBe(false);
  });
});

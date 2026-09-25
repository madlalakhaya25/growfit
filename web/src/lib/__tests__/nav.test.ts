import { isActiveHref, pickLongestActiveHref } from "@/lib/nav";

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

// Regression tests for the two known cross-section collisions this fixes:
// isActiveHref alone can't tell which of several matching hrefs is the
// *best* match, so whichever section/tab happened to be listed first won
// even when another candidate matched more specifically.
describe("pickLongestActiveHref", () => {
  it("picks the exact Compliance match over the shorter People prefix match", () => {
    const hrefs = ["/dashboard/admin/players", "/dashboard/admin/players/documents"];
    expect(
      pickLongestActiveHref("/dashboard/admin/players/documents", hrefs, "/dashboard/admin")
    ).toBe("/dashboard/admin/players/documents");
  });

  it("still picks the People page itself when there's no deeper match", () => {
    const hrefs = ["/dashboard/admin/players", "/dashboard/admin/players/documents"];
    expect(
      pickLongestActiveHref("/dashboard/admin/players", hrefs, "/dashboard/admin")
    ).toBe("/dashboard/admin/players");
  });

  it("picks the exact Emergency match over the shorter Players prefix match, within the same section", () => {
    const hrefs = ["/dashboard/coach/squad", "/dashboard/coach/welfare", "/dashboard/coach/squad/emergency"];
    expect(
      pickLongestActiveHref("/dashboard/coach/squad/emergency", hrefs, "/dashboard/coach")
    ).toBe("/dashboard/coach/squad/emergency");
  });

  it("returns null when nothing matches", () => {
    expect(pickLongestActiveHref("/dashboard/coach/announcements", ["/dashboard/coach/squad"], "/dashboard/coach")).toBeNull();
  });

  it("works without a roleRoot, for SectionTabs' own sub-tabs", () => {
    const hrefs = ["/dashboard/coach/squad", "/dashboard/coach/squad/emergency"];
    expect(pickLongestActiveHref("/dashboard/coach/squad/emergency", hrefs)).toBe("/dashboard/coach/squad/emergency");
    expect(pickLongestActiveHref("/dashboard/coach/squad", hrefs)).toBe("/dashboard/coach/squad");
  });
});

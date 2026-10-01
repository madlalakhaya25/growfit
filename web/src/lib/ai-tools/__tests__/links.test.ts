import { isInternalHref, selectCitedLinks } from "../links";

const L = (label: string, id: string, match?: string[]) => ({ label, href: `/dashboard/coach/squad/${id}`, match });

describe("selectCitedLinks", () => {
  const roster = [L("Sipho Dlamini", "1", ["Sipho Dlamini"]), L("Anele Dube", "2", ["Anele Dube"]), L("Zola Nkosi", "3", ["Zola Nkosi"])];

  it("offers only the rows the answer mentions, in order of first mention", () => {
    const out = selectCitedLinks(roster, "Zola Nkosi is fine, but Sipho Dlamini has missed three sessions.");
    expect(out.map((l) => l.label)).toEqual(["Zola Nkosi", "Sipho Dlamini"]);
  });
  it("matches a unique first name", () => {
    expect(selectCitedLinks(roster, "Anele has been excellent.").map((l) => l.label)).toEqual(["Anele Dube"]);
  });
  it("does not light up two players for an ambiguous first name", () => {
    const twins = [L("Sipho Dlamini", "1", ["Sipho Dlamini"]), L("Sipho Zulu", "2", ["Sipho Zulu"])];
    expect(selectCitedLinks(twins, "Sipho needs a check-in.")).toEqual([]);
    expect(selectCitedLinks(twins, "Sipho Zulu needs a check-in.").map((l) => l.label)).toEqual(["Sipho Zulu"]);
  });
  it("is case and whitespace insensitive", () => {
    expect(selectCitedLinks(roster, "sipho   DLAMINI").map((l) => l.label)).toEqual(["Sipho Dlamini"]);
  });
  it("offers nothing when nothing is cited, and never a stripped-down name for a short token", () => {
    expect(selectCitedLinks(roster, "Nobody here.")).toEqual([]);
    expect(selectCitedLinks([L("Al Bo", "9", ["Al Bo"])], "Al is fine")).toEqual([]);
  });
  it("always offers a link with no match, after the cited ones, deduplicated by href", () => {
    const out = selectCitedLinks([L("Drills", "d"), ...roster, roster[0]], "Sipho Dlamini could try a rondo.");
    expect(out.map((l) => l.label)).toEqual(["Sipho Dlamini", "Drills"]);
  });
  it("caps the number of chips and strips the match field from what it returns", () => {
    const many = Array.from({ length: 12 }, (_, i) => L(`Player${String(i).padStart(2, "0")} X`, String(i), [`Player${String(i).padStart(2, "0")} X`]));
    const out = selectCitedLinks(many, many.map((m) => m.label).join(", "));
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({ label: "Player00 X", href: "/dashboard/coach/squad/0" });
  });
  it("drops hrefs that are not in-app dashboard paths", () => {
    const bad = [{ label: "x", href: "https://evil.example/x", match: ["x"] }, { label: "y", href: "//evil.example", match: ["y"] }, { label: "z", href: "/api/agent", match: ["z"] }];
    expect(selectCitedLinks(bad, "x y z")).toEqual([]);
  });
});

describe("isInternalHref", () => {
  it("accepts dashboard paths only", () => {
    expect(isInternalHref("/dashboard/coach/squad/abc-123")).toBe(true);
    expect(isInternalHref("/dashboard/coach/fixtures/1?x=1")).toBe(false);
    expect(isInternalHref("javascript:alert(1)")).toBe(false);
    expect(isInternalHref("/dashboard//evil")).toBe(false);
  });
});

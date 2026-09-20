import {
  PARENT_LINK_CODE_LENGTH,
  formatParentLinkCode,
  isCompleteParentLinkCode,
  isMissingParentLinkRpc,
  looksLikeAccessCode,
  normalizeParentLinkCode,
} from "@/lib/parent-link";
import {
  ACCESS_CODE_LENGTH,
  isCompleteAccessCode,
  normalizeAccessCode,
} from "@/lib/access-codes";

describe("normalizeParentLinkCode", () => {
  it("mirrors the database's own normalisation", () => {
    expect(normalizeParentLinkCode("7f3a29c1b4")).toBe("7F3A29C1B4");
    expect(normalizeParentLinkCode("  7F3A2-9C1B4\n")).toBe("7F3A29C1B4");
    expect(normalizeParentLinkCode("7f3a2 9c1b4")).toBe("7F3A29C1B4");
  });

  it("survives the display hyphen round-tripping back in", () => {
    const code = "7F3A29C1B4";
    expect(normalizeParentLinkCode(formatParentLinkCode(code))).toBe(code);
  });

  it("does not throw on empty input", () => {
    expect(normalizeParentLinkCode("")).toBe("");
  });
});

describe("isCompleteParentLinkCode", () => {
  it("accepts exactly 10 significant characters", () => {
    expect(isCompleteParentLinkCode("7F3A29C1B4")).toBe(true);
    expect(isCompleteParentLinkCode("7F3A2-9C1B4")).toBe(true);
  });

  it("rejects anything shorter or longer", () => {
    expect(isCompleteParentLinkCode("7F3A29C1B")).toBe(false);
    expect(isCompleteParentLinkCode("7F3A29C1B45")).toBe(false);
    expect(isCompleteParentLinkCode("")).toBe(false);
  });
});

describe("formatParentLinkCode", () => {
  it("hyphenates a full code 5-5", () => {
    expect(formatParentLinkCode("7F3A29C1B4")).toBe("7F3A2-9C1B4");
  });

  it("leaves an incomplete code unhyphenated rather than misleading", () => {
    expect(formatParentLinkCode("7F3A2")).toBe("7F3A2");
  });
});

describe("the two code families stay distinguishable", () => {
  // The whole reason parent-link codes are 10 characters is so a parent
  // pasting one into the club-code box gets a useful error. If these lengths
  // ever converge, that safeguard silently disappears.
  it("uses different lengths", () => {
    expect(PARENT_LINK_CODE_LENGTH).not.toBe(ACCESS_CODE_LENGTH);
  });

  it("rejects each other's codes", () => {
    const clubCode = "ABC123";
    const parentCode = "7F3A29C1B4";
    expect(isCompleteAccessCode(clubCode)).toBe(true);
    expect(isCompleteParentLinkCode(clubCode)).toBe(false);
    expect(isCompleteParentLinkCode(parentCode)).toBe(true);
    expect(isCompleteAccessCode(parentCode)).toBe(false);
  });

  it("normalises identically, so only length distinguishes them", () => {
    expect(normalizeParentLinkCode(" abc-123 ")).toBe(normalizeAccessCode(" abc-123 "));
  });

  it("recognises a club code pasted into the child-code box", () => {
    expect(looksLikeAccessCode("ABC123")).toBe(true);
    expect(looksLikeAccessCode("7F3A29C1B4")).toBe(false);
  });
});

describe("isMissingParentLinkRpc", () => {
  // Migration 032 ships inert. Callers must fail closed on this, never fall
  // back to the direct insert it removes.
  it("matches PostgREST's 'function not found'", () => {
    expect(isMissingParentLinkRpc({ code: "PGRST202" })).toBe(true);
  });

  it("does not swallow an RLS denial or any other real failure", () => {
    expect(isMissingParentLinkRpc({ code: "42501" })).toBe(false);
    expect(isMissingParentLinkRpc({ code: "PGRST204" })).toBe(false);
    expect(isMissingParentLinkRpc({})).toBe(false);
    expect(isMissingParentLinkRpc(null)).toBe(false);
    expect(isMissingParentLinkRpc(undefined)).toBe(false);
  });
});

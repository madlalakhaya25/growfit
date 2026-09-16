import { normalizeAccessCode, isCompleteAccessCode, describeAccessCodeKind } from "@/lib/access-codes";

describe("normalizeAccessCode", () => {
  it("uppercases a lowercase code", () => {
    expect(normalizeAccessCode("abc123")).toBe("ABC123");
  });

  it("strips a pasted trailing newline", () => {
    // squad.ts's old .toUpperCase()-only normalisation failed on this.
    expect(normalizeAccessCode("ABC123\n")).toBe("ABC123");
  });

  it("strips a leading space without truncating the real code", () => {
    // auth/role/page.tsx's old length-only check truncated " ABC123" to
    // "ABC12" against maxLength={6} and rejected it as the wrong length.
    expect(normalizeAccessCode(" ABC123")).toBe("ABC123");
  });

  it("strips internal whitespace", () => {
    expect(normalizeAccessCode("AB C123")).toBe("ABC123");
  });

  it("strips punctuation from a pasted code", () => {
    expect(normalizeAccessCode("ABC-123")).toBe("ABC123");
  });

  it("returns an empty string for empty input", () => {
    expect(normalizeAccessCode("")).toBe("");
  });
});

describe("isCompleteAccessCode", () => {
  it("accepts a clean 6-character code", () => {
    expect(isCompleteAccessCode("ABC123")).toBe(true);
  });

  it("accepts a code that is only 6 characters after normalising", () => {
    expect(isCompleteAccessCode(" abc123 ")).toBe(true);
  });

  it("rejects a code that is too short even after normalising", () => {
    expect(isCompleteAccessCode("ABC12")).toBe(false);
  });

  it("rejects a code padded to 6 raw characters by whitespace alone", () => {
    expect(isCompleteAccessCode("ABC12 ")).toBe(false);
  });
});

describe("describeAccessCodeKind", () => {
  it("labels each known kind", () => {
    expect(describeAccessCodeKind("team_coach")).toMatch(/coach/);
    expect(describeAccessCodeKind("team_player")).toMatch(/squad/);
    expect(describeAccessCodeKind("academy")).toMatch(/academy/);
  });

  it("falls back gracefully for an unknown kind", () => {
    expect(describeAccessCodeKind(undefined)).toBe("something");
  });
});

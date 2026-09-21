import {
  loginSchema,
  otpSchema,
  createPlayerSchema,
  createTeamSchema,
  createFixtureSchema,
  playerRatingSchema,
  linkChildSchema,
} from "@/lib/validation";

describe("loginSchema — SA phone numbers", () => {
  const valid = ["0712345678", "0812345678", "0612345678", "+27712345678"];
  const invalid = ["0112345678", "071234", "07123456789", "", "abcdefghij"];

  valid.forEach((phone) => {
    it(`accepts ${phone}`, () => {
      expect(loginSchema.safeParse({ phone }).success).toBe(true);
    });
  });

  invalid.forEach((phone) => {
    it(`rejects "${phone}"`, () => {
      expect(loginSchema.safeParse({ phone }).success).toBe(false);
    });
  });
});

describe("otpSchema", () => {
  it("accepts exactly 6 chars", () =>
    expect(otpSchema.safeParse({ token: "123456" }).success).toBe(true));
  it("rejects 5 chars", () =>
    expect(otpSchema.safeParse({ token: "12345" }).success).toBe(false));
  it("rejects 7 chars", () =>
    expect(otpSchema.safeParse({ token: "1234567" }).success).toBe(false));
  it("rejects empty", () =>
    expect(otpSchema.safeParse({ token: "" }).success).toBe(false));
});

describe("createPlayerSchema", () => {
  it("requires full_name of at least 2 chars", () => {
    expect(createPlayerSchema.safeParse({ full_name: "A" }).success).toBe(false);
    expect(createPlayerSchema.safeParse({ full_name: "Al" }).success).toBe(true);
  });

  it("rejects invalid positions", () => {
    expect(
      createPlayerSchema.safeParse({ full_name: "Sam", position: "invalid" }).success
    ).toBe(false);
  });

  it("accepts all valid positions", () => {
    ["goalkeeper", "defender", "midfielder", "winger", "striker"].forEach((pos) => {
      expect(
        createPlayerSchema.safeParse({ full_name: "Sam", position: pos }).success
      ).toBe(true);
    });
  });

  it("accepts all valid preferred_foot values", () => {
    ["left", "right", "both"].forEach((foot) => {
      expect(
        createPlayerSchema.safeParse({ full_name: "Sam", preferred_foot: foot }).success
      ).toBe(true);
    });
  });
});

describe("createTeamSchema", () => {
  it("requires name of at least 2 chars", () => {
    expect(createTeamSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createTeamSchema.safeParse({ name: "AA" }).success).toBe(true);
  });

  it("age_group is optional", () => {
    expect(createTeamSchema.safeParse({ name: "GrowFit" }).success).toBe(true);
  });
});

describe("createFixtureSchema", () => {
  const base = { opponent: "Sundowns", fixture_date: "2026-06-01T10:00", is_home: true };

  it("accepts valid fixture", () =>
    expect(createFixtureSchema.safeParse(base).success).toBe(true));

  it("rejects short opponent name", () =>
    expect(createFixtureSchema.safeParse({ ...base, opponent: "X" }).success).toBe(false));

  it("rejects missing fixture_date", () =>
    expect(createFixtureSchema.safeParse({ ...base, fixture_date: "" }).success).toBe(false));

  it("accepts optional venue and notes", () =>
    expect(
      createFixtureSchema.safeParse({ ...base, venue: "FNB Stadium", notes: "Big game" }).success
    ).toBe(true));

  it("rejects notes over 500 chars", () =>
    expect(
      createFixtureSchema.safeParse({ ...base, notes: "x".repeat(501) }).success
    ).toBe(false));
});

describe("playerRatingSchema", () => {
  it("accepts 1–5", () => {
    [1, 2, 3, 4, 5].forEach((rating) => {
      expect(playerRatingSchema.safeParse({ rating }).success).toBe(true);
    });
  });

  it("rejects 0 and 6", () => {
    expect(playerRatingSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(playerRatingSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects non-integer", () =>
    expect(playerRatingSchema.safeParse({ rating: 2.5 }).success).toBe(false));

  it("rejects note over 200 chars", () =>
    expect(
      playerRatingSchema.safeParse({ rating: 3, note: "x".repeat(201) }).success
    ).toBe(false));
});

describe("linkChildSchema", () => {
  it("accepts a 10-character code", () =>
    expect(linkChildSchema.safeParse({ code: "7F3A29C1B4" }).success).toBe(true));
  it("normalizes lowercase and a formatting hyphen before checking length", () =>
    expect(linkChildSchema.safeParse({ code: "7f3a2-9c1b4" }).success).toBe(true));
  it("rejects a code shorter than 10 characters", () =>
    expect(linkChildSchema.safeParse({ code: "ABC123" }).success).toBe(false));
  it("rejects a code longer than 10 characters", () =>
    expect(linkChildSchema.safeParse({ code: "7F3A29C1B4EXTRA" }).success).toBe(false));
});

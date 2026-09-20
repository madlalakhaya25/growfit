import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createPlayerSchema,
  createTeamSchema,
  createFixtureSchema,
  playerRatingSchema,
  linkChildSchema,
} from "@/lib/validation";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret1" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "secret1" }).success).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "abc" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });

  it("rejects an empty email", () => {
    expect(loginSchema.safeParse({ email: "", password: "secret1" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    expect(
      registerSchema.safeParse({
        full_name: "Sipho Dlamini",
        email: "sipho@example.com",
        password: "password123",
        role: "player",
      }).success
    ).toBe(true);
  });

  it("registers a parent without any child code", () => {
    // Linking a child at registration time is gone — it let an adult attach
    // themselves to a child using the child's public share token. See
    // migration 032.
    expect(
      registerSchema.safeParse({
        full_name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        role: "parent",
      }).success
    ).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(
      registerSchema.safeParse({
        full_name: "J",
        email: "j@example.com",
        password: "password123",
        role: "player",
      }).success
    ).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      registerSchema.safeParse({
        full_name: "Sipho Dlamini",
        email: "sipho@example.com",
        password: "short",
        role: "player",
      }).success
    ).toBe(false);
  });

  it("rejects an invalid role", () => {
    expect(
      registerSchema.safeParse({
        full_name: "Sipho Dlamini",
        email: "sipho@example.com",
        password: "password123",
        role: "admin",
      }).success
    ).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "newpassword", confirm: "newpassword" }).success
    ).toBe(true);
  });

  it("rejects when passwords don't match", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "newpassword", confirm: "different" }).success
    ).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "short", confirm: "short" }).success
    ).toBe(false);
  });

  it("rejects an empty confirm field", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "newpassword", confirm: "" }).success
    ).toBe(false);
  });
});

describe("createPlayerSchema", () => {
  it("accepts valid full player data", () => {
    const result = createPlayerSchema.safeParse({
      full_name: "Sipho Dlamini",
      position: "striker",
      preferred_foot: "right",
      date_of_birth: "2008-03-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with only required field", () => {
    expect(
      createPlayerSchema.safeParse({ full_name: "Jo" }).success
    ).toBe(true);
  });

  it("rejects a name that is too short", () => {
    expect(
      createPlayerSchema.safeParse({ full_name: "J" }).success
    ).toBe(false);
  });

  it("rejects an invalid position value", () => {
    expect(
      createPlayerSchema.safeParse({ full_name: "Sam", position: "coach" }).success
    ).toBe(false);
  });

  it("rejects an invalid preferred_foot value", () => {
    expect(
      createPlayerSchema.safeParse({ full_name: "Sam", preferred_foot: "center" }).success
    ).toBe(false);
  });
});

describe("createTeamSchema", () => {
  it("accepts valid team data", () => {
    expect(
      createTeamSchema.safeParse({ name: "GrowFit U17", age_group: "U17" }).success
    ).toBe(true);
  });

  it("accepts without optional age_group", () => {
    expect(createTeamSchema.safeParse({ name: "GrowFit U17" }).success).toBe(true);
  });

  it("rejects a name that is too short", () => {
    expect(createTeamSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

describe("createFixtureSchema", () => {
  it("accepts a valid fixture", () => {
    expect(
      createFixtureSchema.safeParse({
        opponent: "Sundowns Academy",
        fixture_date: "2026-06-01T10:00",
        is_home: true,
      }).success
    ).toBe(true);
  });

  it("rejects when opponent is too short", () => {
    expect(
      createFixtureSchema.safeParse({
        opponent: "X",
        fixture_date: "2026-06-01T10:00",
        is_home: false,
      }).success
    ).toBe(false);
  });

  it("rejects when fixture_date is empty", () => {
    expect(
      createFixtureSchema.safeParse({
        opponent: "Sundowns Academy",
        fixture_date: "",
        is_home: true,
      }).success
    ).toBe(false);
  });
});

describe("playerRatingSchema", () => {
  it("accepts ratings 1–5", () => {
    [1, 2, 3, 4, 5].forEach((rating) => {
      expect(playerRatingSchema.safeParse({ rating }).success).toBe(true);
    });
  });

  it("rejects 0 and 6", () => {
    expect(playerRatingSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(playerRatingSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(playerRatingSchema.safeParse({ rating: 3.5 }).success).toBe(false);
  });

  it("accepts an optional note under 200 chars", () => {
    expect(
      playerRatingSchema.safeParse({ rating: 4, note: "Great work" }).success
    ).toBe(true);
  });

  it("rejects a note over 200 chars", () => {
    expect(
      playerRatingSchema.safeParse({ rating: 4, note: "x".repeat(201) }).success
    ).toBe(false);
  });
});

describe("linkChildSchema", () => {
  it("accepts a 10-character staff-issued link code", () => {
    expect(linkChildSchema.safeParse({ code: "7F3A29C1B4" }).success).toBe(true);
  });

  it("accepts the hyphenated display form", () => {
    expect(linkChildSchema.safeParse({ code: "7f3a2-9c1b4" }).success).toBe(true);
  });

  it("rejects a 6-character club code pasted into the wrong box", () => {
    expect(linkChildSchema.safeParse({ code: "ABC123" }).success).toBe(false);
  });

  it("rejects anything that is not 10 significant characters", () => {
    expect(linkChildSchema.safeParse({ code: "abc" }).success).toBe(false);
    expect(linkChildSchema.safeParse({ code: "7F3A29C1B45" }).success).toBe(false);
    expect(linkChildSchema.safeParse({ code: "" }).success).toBe(false);
  });

  it("no longer accepts a share token", () => {
    expect(linkChildSchema.safeParse({ share_token: "a1b2c3d4e5" }).success).toBe(false);
  });
});

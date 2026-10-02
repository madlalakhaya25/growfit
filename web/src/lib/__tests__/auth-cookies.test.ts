import {
  authCookieOptions, forgetSignIn, keepSignedInCookieString, keepsSignedIn, rememberSignIn,
  KEEP_SIGNED_IN_COOKIE, KEEP_SIGNED_IN_SECONDS,
} from "@/lib/auth-cookies";

describe("keepsSignedIn", () => {
  it("is true for coaches, admins and parents, false for players and unknowns", () => {
    expect(keepsSignedIn("coach")).toBe(true);
    expect(keepsSignedIn("admin")).toBe(true);
    expect(keepsSignedIn("parent")).toBe(true);
    expect(keepsSignedIn("player")).toBe(false);
    expect(keepsSignedIn(null)).toBe(false);
    expect(keepsSignedIn(undefined)).toBe(false);
    expect(keepsSignedIn("anything")).toBe(false);
  });
});

describe("authCookieOptions", () => {
  it("gives a person who keeps their sign-in a 30 day cookie, overriding Supabase's own lifetime", () => {
    const out = authCookieOptions({ path: "/", sameSite: "lax", maxAge: 400 * 86400 }, true);
    expect(out.maxAge).toBe(30 * 86400);
    expect(out.maxAge).toBe(KEEP_SIGNED_IN_SECONDS);
    expect(out.path).toBe("/");
    expect(out.sameSite).toBe("lax");
  });

  it("keeps everyone else session-only: no maxAge at all", () => {
    const out = authCookieOptions({ path: "/", maxAge: 400 * 86400 }, false);
    expect(out).toEqual({ path: "/" });
    expect("maxAge" in out).toBe(false);
  });

  it("copes with no options", () => {
    expect(authCookieOptions(undefined, false)).toEqual({});
    expect(authCookieOptions(undefined, true)).toEqual({ maxAge: KEEP_SIGNED_IN_SECONDS });
  });
});

describe("keepSignedInCookieString", () => {
  it("lasts 30 days for coaches and parents", () => {
    for (const role of ["coach", "admin", "parent"]) {
      const c = keepSignedInCookieString(role);
      expect(c).toContain(`${KEEP_SIGNED_IN_COOKIE}=1`);
      expect(c).toContain(`max-age=${KEEP_SIGNED_IN_SECONDS}`);
    }
  });
  it("is a session-only 0 for players, so it overwrites a coach's marker on a shared phone", () => {
    const c = keepSignedInCookieString("player");
    expect(c).toContain(`${KEEP_SIGNED_IN_COOKIE}=0`);
    expect(c).not.toContain("max-age");
  });
});

describe("rememberSignIn / forgetSignIn", () => {
  afterEach(() => forgetSignIn());

  it("writes the marker for a coach and clears it on sign-out", () => {
    rememberSignIn("coach");
    expect(document.cookie).toContain(`${KEEP_SIGNED_IN_COOKIE}=1`);
    forgetSignIn();
    expect(document.cookie).not.toContain(`${KEEP_SIGNED_IN_COOKIE}=1`);
  });

  it("a player signing in after a coach on the same device overwrites the marker", () => {
    rememberSignIn("coach");
    rememberSignIn("player");
    expect(document.cookie).toContain(`${KEEP_SIGNED_IN_COOKIE}=0`);
    expect(document.cookie).not.toContain(`${KEEP_SIGNED_IN_COOKIE}=1`);
  });
});

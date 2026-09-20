import { friendlyError } from "@/lib/friendly-error";

describe("friendlyError", () => {
  it("translates RLS denial", () => {
    expect(friendlyError({ code: "42501" })).toBe("You don't have permission to do that.");
  });

  it("translates a unique-constraint violation without naming the constraint", () => {
    const message = friendlyError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "team_members_pkey"',
    });
    expect(message).toBe("That already exists.");
    expect(message).not.toMatch(/pkey|constraint|team_members/i);
  });

  it("translates a foreign-key violation without naming the table", () => {
    const message = friendlyError({
      code: "23503",
      message: 'insert or update on table "player_ratings" violates foreign key constraint',
    });
    expect(message).not.toMatch(/player_ratings|constraint/i);
  });

  it("translates a check violation", () => {
    expect(friendlyError({ code: "23514" })).toBe("That value isn't allowed.");
  });

  it("translates a missing required field", () => {
    expect(friendlyError({ code: "23502" })).toBe("A required field is missing.");
  });

  it("translates a missing migration the same way the ad-hoc checks elsewhere do", () => {
    expect(friendlyError({ code: "42703" })).toMatch(/not fully set up|administrator/i);
    expect(friendlyError({ code: "PGRST204" })).toMatch(/not fully set up|administrator/i);
    expect(friendlyError({ code: "PGRST202" })).toMatch(/not available|administrator/i);
  });

  it("translates .single() finding zero or multiple rows", () => {
    expect(friendlyError({ code: "PGRST116" })).toMatch(/couldn't find|removed/i);
  });

  it("translates expired session from a code or from message text", () => {
    expect(friendlyError({ code: "PGRST301" })).toMatch(/session has expired/i);
    expect(friendlyError({ message: "JWT expired" })).toMatch(/session has expired/i);
  });

  it("translates a network failure", () => {
    expect(friendlyError({ message: "Failed to fetch" })).toMatch(/couldn't connect|internet/i);
  });

  it("falls back to a generic message for anything unrecognised, never echoing raw text", () => {
    const message = friendlyError({ code: "XX000", message: "unexpected internal server state at frame 0x7f" });
    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toMatch(/frame|0x7f/);
  });

  it("uses the caller-supplied fallback when given one", () => {
    expect(friendlyError({ code: "XX000" }, "Couldn't save your rating.")).toBe(
      "Couldn't save your rating."
    );
  });

  it("handles null, undefined, and non-object errors without throwing", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError(undefined)).toBe("Something went wrong. Please try again.");
    expect(friendlyError("a plain string")).toBe("Something went wrong. Please try again.");
    expect(friendlyError(42)).toBe("Something went wrong. Please try again.");
  });

  it("never returns an empty string", () => {
    for (const input of [null, undefined, {}, { code: "" }, { message: "" }]) {
      expect(friendlyError(input).length).toBeGreaterThan(0);
    }
  });
});

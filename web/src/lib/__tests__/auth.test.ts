/** @jest-environment node */
const mockGetClaims = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mockGetClaims, getUser: mockGetUser } }),
}));
jest.mock("server-only", () => ({}));

import { getAuthUser } from "../auth";

describe("getAuthUser", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns the user id from the verified token without asking the Auth server", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "u1" } }, error: null });
    await expect(getAuthUser()).resolves.toEqual({ id: "u1" });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null when there is no session", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null });
    await expect(getAuthUser()).resolves.toBeNull();
  });

  it("returns null when the token fails verification", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT") });
    await expect(getAuthUser()).resolves.toBeNull();
  });
});

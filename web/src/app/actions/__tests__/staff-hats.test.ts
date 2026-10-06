/**
 * Giving and taking off staff hats. What is tested: only an admin may, a bad
 * person or hat writes nothing, a hat is written for the admin's own academy,
 * wearing one already is fine, and a missing table is a plain message.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockAdmin = jest.fn();
jest.mock("@/lib/admin-context", () => ({ adminContext: () => mockAdmin() }));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { setStaffHat } from "../staff-hats";

const P = "11111111-1111-4111-8111-111111111111";

function setup(over: { admin?: boolean; error?: { code: string } } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => { ops.push(op); return over.error ? { error: over.error } : {}; });
  mockAdmin.mockResolvedValue(over.admin === false ? null : { supabase: f.client, userId: "admin1", academyId: "acad1" });
  return ops;
}

beforeEach(() => jest.clearAllMocks());

it("adds a hat for the admin's own academy", async () => {
  const ops = setup();
  expect(await setStaffHat(P, "director", true)).toEqual({ success: true });
  expect(ops).toEqual([{ table: "staff_hats", action: "insert", one: false, payload: { profile_id: P, academy_id: "acad1", hat: "director", created_by: "admin1" } }]);
});

it("takes a hat off", async () => {
  const ops = setup();
  expect(await setStaffHat(P, "director", false)).toEqual({ success: true });
  expect(ops.map((o) => o.action)).toEqual(["delete"]);
});

it("refuses a non-admin, a bad person and an unknown hat, writing nothing", async () => {
  const none = setup({ admin: false });
  expect(await setStaffHat(P, "director", true)).toEqual({ error: "Unauthorized" });
  const bad = setup();
  expect(await setStaffHat("nope", "director", true)).toEqual({ error: "Choose a person and a hat." });
  expect(await setStaffHat(P, "owner", true)).toEqual({ error: "Choose a person and a hat." });
  expect([...none, ...bad]).toEqual([]);
});

it("treats wearing the hat already as done, and a missing table as a plain message", async () => {
  setup({ error: { code: "23505" } });
  expect(await setStaffHat(P, "director", true)).toEqual({ success: true });
  setup({ error: { code: "PGRST205" } });
  expect(await setStaffHat(P, "director", true)).toEqual({ error: "Staff hats are not set up yet." });
});

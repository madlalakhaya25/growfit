import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadOwnHats, loadStaffWithHats } from "../staff-hats-data";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
const as = (f: ReturnType<typeof fakeSupabase>) => f.client as unknown as Client;

describe("loadStaffWithHats", () => {
  it("joins each person with their hats, dropping unknown ones", async () => {
    const f = fakeSupabase((op) =>
      op.table === "profiles"
        ? { data: [{ id: "a", full_name: "Buhle", role: "admin" }, { id: "b", full_name: "Sphe", role: "coach" }] }
        : { data: [{ profile_id: "a", hat: "finance" }, { profile_id: "a", hat: "director" }, { profile_id: "a", hat: "owner" }] },
    );
    expect(await loadStaffWithHats(as(f), "acad")).toEqual({
      available: true,
      staff: [
        { id: "a", name: "Buhle", role: "admin", hats: ["director", "finance"] },
        { id: "b", name: "Sphe", role: "coach", hats: [] },
      ],
    });
  });

  it("says not available when the table is missing", async () => {
    const f = fakeSupabase((op) => (op.table === "staff_hats" ? { error: { code: "PGRST205" } } : { data: [] }));
    expect(await loadStaffWithHats(as(f), "acad")).toEqual({ available: false, staff: [] });
  });
});

describe("loadOwnHats", () => {
  it("returns the person's hats, or none on any error", async () => {
    const ok = fakeSupabase(() => ({ data: [{ hat: "safeguarding" }] }));
    expect(await loadOwnHats(as(ok), "a")).toEqual(["safeguarding"]);
    const bad = fakeSupabase(() => ({ error: { code: "42P01" } }));
    expect(await loadOwnHats(as(bad), "a")).toEqual([]);
  });
});

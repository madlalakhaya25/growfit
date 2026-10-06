import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadDirectorCards } from "../director-data";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
const teams = [{ id: "t1", name: "U11" }, { id: "t2", name: "U13" }];
const now = new Date("2026-10-06T10:00:00Z");

function client(handler: Parameters<typeof fakeSupabase>[0]) {
  const f = fakeSupabase(handler);
  return { f, c: f.client as unknown as Client };
}

describe("loadDirectorCards", () => {
  it("loads nothing for cards that are not shown", async () => {
    const { f, c } = client(() => ({ data: [] }));
    expect(await loadDirectorCards(c, teams, ["quick_actions"], now)).toEqual({ objectives: null, fixtures: null, sessions: null, coverage: null });
    expect(f.calls).toEqual([]);
  });

  it("reads fixtures with team names and hides the card when the read fails", async () => {
    const ok = client(() => ({ data: [{ team_id: "t2", opponent: "Rovers", fixture_date: "2026-10-11T13:00:00Z" }] }));
    expect((await loadDirectorCards(ok.c, teams, ["fixtures"], now)).fixtures).toEqual([
      { teamName: "U13", opponent: "Rovers", kickoff: "2026-10-11T13:00:00Z" },
    ]);
    const bad = client(() => ({ error: { code: "500" } }));
    expect((await loadDirectorCards(bad.c, teams, ["fixtures"], now)).fixtures).toBeNull();
  });

  it("counts sessions inside the term window per team", async () => {
    const { c } = client((op) =>
      op.table === "academy_terms"
        ? { data: [{ starts_on: "2026-07-20", ends_on: "2026-09-25" }] }
        : { data: [{ team_id: "t1", session_date: "2026-08-05T15:00:00Z" }, { team_id: "t1", session_date: "2026-10-01T15:00:00Z" }] },
    );
    const lines = (await loadDirectorCards(c, teams, ["sessions"], now)).sessions;
    expect(lines).toEqual([
      { teamId: "t2", name: "U13", sessions: 0 },
      { teamId: "t1", name: "U11", sessions: 1 },
    ]);
  });

  it("hides coverage when there is no curriculum yet", async () => {
    const { c } = client((op) => (op.table === "curriculum_items" ? { error: { code: "PGRST205" } } : { data: [] }));
    expect((await loadDirectorCards(c, teams, ["coverage"], now)).coverage).toBeNull();
  });

  it("hides team cards when the academy has no active teams", async () => {
    const { f, c } = client(() => ({ data: [] }));
    expect(await loadDirectorCards(c, [], ["fixtures", "objectives", "sessions"], now)).toEqual({ objectives: null, fixtures: null, sessions: null, coverage: null });
    expect(f.calls).toEqual([]);
  });
});

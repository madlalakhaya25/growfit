/**
 * Loading open objectives for the coach screens. What is tested: rows become
 * objectives with their linked counts, an unknown phase is dropped rather than
 * trusted, and a read error or a missing table reads as "none", never a failure.
 */
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

import { loadOpenObjectives } from "../objectives-data";
import { fakeSupabase, type FakeReply } from "@/test-utils/fake-supabase";

function load(reply: FakeReply, teamIds = ["t1"]) {
  const f = fakeSupabase(() => reply);
  return loadOpenObjectives(f.client as never, teamIds).then((rows) => ({ rows, calls: f.calls }));
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "o1", subject_id: "t1", phase: "in_possession", problem: "Lose it at the back",
  objective: "Keep the ball playing out", created_at: "2026-10-06T10:00:00Z",
  development_objective_links: [{ link_id: "s1" }, { link_id: "s2" }], ...over,
});

it("maps rows to objectives with how much is planned", async () => {
  const { rows } = await load({ data: [row()] });
  expect(rows).toEqual([{
    id: "o1", teamId: "t1", phase: "in_possession", problem: "Lose it at the back",
    objective: "Keep the ball playing out", createdAt: "2026-10-06T10:00:00Z", linkedCount: 2,
  }]);
});

it("counts none when there are no links, and drops a phase it does not know", async () => {
  const { rows } = await load({ data: [row({ phase: "tiki_taka", development_objective_links: null })] });
  expect(rows[0].phase).toBeNull();
  expect(rows[0].linkedCount).toBe(0);
});

it("reads as empty when the table is missing or the read fails", async () => {
  expect((await load({ error: { code: "PGRST205" } })).rows).toEqual([]);
  expect((await load({ error: { code: "XX000" } })).rows).toEqual([]);
});

it("does not query at all when there are no teams", async () => {
  const { rows, calls } = await load({ data: [row()] }, []);
  expect(rows).toEqual([]);
  expect(calls).toHaveLength(0);
});

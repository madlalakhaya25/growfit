/**
 * Loading open objectives for the coach screens. What is tested: rows become
 * objectives with their linked counts, an unknown phase is dropped rather than
 * trusted, and a read error or a missing table reads as "none", never a failure.
 */
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

import { closeObjectivesWithVerdict, loadClosedObjectives, loadFollowUpPrompts, loadOpenObjectives } from "../objectives-data";
import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";

function load(reply: FakeReply, teamIds = ["t1"]) {
  const f = fakeSupabase(() => reply);
  return loadOpenObjectives(f.client as never, teamIds).then((rows) => ({ rows, calls: f.calls }));
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "o1", subject_id: "t1", phase: "in_possession", problem: "Lose it at the back",
  objective: "Keep the ball playing out", created_at: "2026-10-06T10:00:00Z",
  source_fixture_id: "f1", development_objective_links: [{ link_id: "s1" }, { link_id: "s2" }], ...over,
});

it("maps rows to objectives with how much is planned", async () => {
  const { rows } = await load({ data: [row()] });
  expect(rows).toEqual([{
    id: "o1", teamId: "t1", phase: "in_possession", problem: "Lose it at the back",
    objective: "Keep the ball playing out", createdAt: "2026-10-06T10:00:00Z", sourceFixtureId: "f1", linkedCount: 2,
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

describe("loadFollowUpPrompts", () => {
  const prompts = (objectives: unknown[], ratings: unknown[]) => {
    const f = fakeSupabase((op: FakeOp): FakeReply =>
      op.table === "development_objectives" ? { data: objectives } : { data: ratings });
    return loadFollowUpPrompts(f.client as never, { teamId: "t1", fixtureId: "f2", fixtureDate: "2026-10-11T13:00:00Z" });
  };

  it("asks about an earlier objective with the rating the phase had at that match", async () => {
    const out = await prompts([row()], [{ fixture_id: "f1", phase_ratings: { in_possession: 2, set_pieces: 4 } }]);
    expect(out).toEqual([{
      id: "o1", problem: "Lose it at the back", objective: "Keep the ball playing out", phase: "in_possession", before: 2,
    }]);
  });

  it("leaves the earlier rating empty when that match had none", async () => {
    const out = await prompts([row()], [{ fixture_id: "f1", phase_ratings: null }]);
    expect(out[0].before).toBeNull();
  });

  it("does not ask about the objective set at this very match", async () => {
    expect(await prompts([row({ source_fixture_id: "f2" })], [])).toEqual([]);
  });
});

describe("closeObjectivesWithVerdict", () => {
  const run = (reply: (op: FakeOp) => FakeReply, answers: { objectiveId: string; answer: "no" | "a_bit" | "yes" }[]) => {
    const f = fakeSupabase(reply);
    return closeObjectivesWithVerdict(f.client as never, { teamId: "t1", fixtureId: "f2", answers, now: new Date("2026-10-11T16:00:00Z") })
      .then((failed) => ({ failed, calls: f.calls }));
  };

  it("closes each answered objective with its verdict, the match and the time", async () => {
    const { failed, calls } = await run(() => ({ data: [{ id: "x" }] }), [
      { objectiveId: "o1", answer: "no" }, { objectiveId: "o2", answer: "yes" },
    ]);
    expect(failed).toBe(0);
    expect(calls.map((c) => c.payload)).toEqual([
      { status: "closed", verdict: "improved", follow_up_fixture_id: "f2", closed_at: "2026-10-11T16:00:00.000Z" },
      { status: "closed", verdict: "not_yet", follow_up_fixture_id: "f2", closed_at: "2026-10-11T16:00:00.000Z" },
    ]);
  });

  it("counts an objective that could not be closed, whether it errored or matched nothing", async () => {
    const replies = [{ error: { code: "XX000" } }, { data: [] }, { data: [{ id: "x" }] }];
    let i = 0;
    const { failed } = await run(() => replies[i++] as FakeReply, [
      { objectiveId: "o1", answer: "no" }, { objectiveId: "o2", answer: "no" }, { objectiveId: "o3", answer: "a_bit" },
    ]);
    expect(failed).toBe(2);
  });
});

describe("loadClosedObjectives", () => {
  it("reports verdict, sessions planned and how the phase rating moved", async () => {
    const f = fakeSupabase((op: FakeOp): FakeReply =>
      op.table === "development_objectives"
        ? { data: [{
            id: "o1", phase: "in_possession", objective: "Keep it", verdict: "improved", closed_at: "2026-10-11T16:00:00Z",
            source_fixture_id: "f1", follow_up_fixture_id: "f2", development_objective_links: [{ link_id: "s1" }],
          }] }
        : { data: [
            { fixture_id: "f1", phase_ratings: { in_possession: 2 } },
            { fixture_id: "f2", phase_ratings: { in_possession: 4 } },
          ] });
    expect(await loadClosedObjectives(f.client as never, "t1")).toEqual([{
      id: "o1", objective: "Keep it", phase: "in_possession", verdict: "improved",
      closedAt: "2026-10-11T16:00:00Z", linkedCount: 1, change: { before: 2, after: 4 },
    }]);
  });

  it("reads as empty with no history, and drops a verdict it does not know", async () => {
    expect(await loadClosedObjectives(fakeSupabase(() => ({ data: [] })).client as never, "t1")).toEqual([]);
    const f = fakeSupabase((op: FakeOp): FakeReply => op.table === "development_objectives"
      ? { data: [{ id: "o1", phase: null, objective: "x", verdict: "great", closed_at: null, source_fixture_id: null, follow_up_fixture_id: null, development_objective_links: null }] }
      : { data: [] });
    const [item] = await loadClosedObjectives(f.client as never, "t1");
    expect(item.verdict).toBeNull();
    expect(item.change).toBeNull();
  });
});

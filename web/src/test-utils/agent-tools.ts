import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";
import type { AgentToolContext } from "@/lib/ai-tools/types";

export const ACADEMY = "11111111-1111-4111-8111-111111111111";
export const OTHER_ACADEMY = "99999999-9999-4999-8999-999999999999";
export const MY_TEAM = "22222222-2222-4222-8222-222222222222";
export const OTHER_TEAM = "33333333-3333-4333-8333-333333333333";
export const P1 = "44444444-4444-4444-8444-444444444444";
export const P2 = "55555555-5555-4555-8555-555555555555";

export function makeCtx(
  handler: (op: FakeOp) => FakeReply,
  over: Partial<AgentToolContext> = {}
) {
  const fake = fakeSupabase(handler);
  const ctx: AgentToolContext = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: fake.client as any,
    userId: "coach-1",
    role: "coach",
    academyId: ACADEMY,
    teamIds: [MY_TEAM],
    ...over,
  };
  return { ctx, calls: fake.calls };
}

/** A player on `teamIds` in `academy`, as `authorisePlayer` will read it. */
export function playerReplies(op: FakeOp, opts: { academy?: string; teams?: string[] } = {}): FakeReply | null {
  const academy = opts.academy ?? ACADEMY;
  const teams = opts.teams ?? [MY_TEAM];
  if (op.table === "players" && op.one) {
    return { data: { academy_id: academy, position: "midfielder", full_name: "Sipho Dlamini" } };
  }
  if (op.table === "team_members" && !op.one) {
    // authorisePlayer reads { team_id }; roster reads are handled by the caller.
    return { data: teams.map((t) => ({ team_id: t })) };
  }
  return null;
}

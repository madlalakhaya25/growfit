import { act, render, screen } from "@testing-library/react";

// next/cache's revalidatePath (used by tactic-plays.ts, imported by
// TacticalBoard) loads Next's server-runtime request/response machinery at
// module-load time, which needs Web-platform globals (Request, Response,
// ReadableStream…) jsdom doesn't provide — a jsdom/Next.js incompatibility
// at import time, not something this test exercises. Mocking the Next.js
// framework API itself (not Supabase, not this app's own action logic) is
// the narrow fix; the real requireCoachTeam/upsert logic in tactic-plays.ts
// is untouched and this mock is never actually called by the test below,
// since teams={[]} means TacticalBoard's own effect never invokes it.
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// tactics.ts (describePlay/analyseOpponent) pulls in @google/genai, whose
// ESM build Jest's default transform doesn't process for node_modules.
// Neither function is called by anything that runs on mount (both are
// behind explicit button handlers this test never clicks), so stubbing the
// module is a build-graph workaround, not a change to tested behaviour.
jest.mock("@/app/actions/tactics", () => ({
  describePlay: jest.fn(),
  analyseOpponent: jest.fn(),
}));

import { TacticalBoard } from "@/components/tactics/tactical-board";

/**
 * The board's own state now lives in store/boardStore.ts (a zustand
 * singleton), so this is the first automated check the ongoing
 * zustand/panel-extraction refactor (docs/BACKLOG.md 3.3) can lean on — a
 * smoke render, not full interaction coverage.
 *
 * Rendered with an empty roster deliberately: TacticalBoard's own
 * useEffect on `[teamId]` calls the tactic-plays.ts server actions
 * (listPlays/listLinkTargets) unconditionally, which need a real request
 * context this test environment doesn't have. With `teams={[]}`, `teamId`
 * stays "" and both of those calls short-circuit before touching Supabase
 * — matching this repo's own no-Supabase/network-mocking test convention
 * (see web/CLAUDE.md's Testing section) rather than mocking around it.
 */
describe("TacticalBoard", () => {
  it("renders the board shell without a team roster, with no network calls needed", async () => {
    render(<TacticalBoard teams={[]} />);
    // Lets the mount-time draft-recovery check (a resolved-Promise
    // microtask, not a network call — see restoreDraft's own effect)
    // settle before asserting, so its setState doesn't warn as an
    // out-of-act update once the test body has already returned.
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText("Set up my XI")).toBeInTheDocument();
    expect(screen.getByText("Your team")).toBeInTheDocument();
    expect(screen.getAllByText("Opponent").length).toBeGreaterThan(0);
  });
});

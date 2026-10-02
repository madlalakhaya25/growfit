import { checkClipConsent, consentBlockMessage } from "../media-consent";

function client(reply: { data?: unknown; error?: { code?: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  return {
    calls,
    rpc: async (fn: string, args: unknown) => { calls.push({ fn, args }); return { data: reply.data ?? null, error: reply.error ?? null }; },
  };
}
const NOW = new Date("2026-10-05T10:00:00Z");

describe("checkClipConsent", () => {
  it("allows a clip only when the database reports no gaps, asking for this season", async () => {
    const c = client({ data: [] });
    expect(await checkClipConsent(c as never, ["a", "b", "a"], NOW)).toEqual({ ok: true });
    expect(c.calls).toEqual([{ fn: "clip_consent_gaps", args: { p_player_ids: ["a", "b"], p_season: "2026" } }]);
  });

  it("blocks and names exactly the children with a gap", async () => {
    const c = client({ data: ["b"] });
    expect(await checkClipConsent(c as never, ["a", "b"], NOW)).toEqual({ ok: false, reason: "missing_consent", blockedPlayerIds: ["b"] });
  });

  it("blocks when no children are named, without asking the database", async () => {
    const c = client({ data: [] });
    expect(await checkClipConsent(c as never, [], NOW)).toMatchObject({ ok: false, reason: "no_players" });
    expect(c.calls).toHaveLength(0);
  });

  it("fails closed when the function is missing, errors, or answers with something odd", async () => {
    expect(await checkClipConsent(client({ error: { code: "42883" } }) as never, ["a"], NOW)).toMatchObject({ ok: false, reason: "not_installed", blockedPlayerIds: ["a"] });
    expect(await checkClipConsent(client({ error: { code: "PGRST202" } }) as never, ["a"], NOW)).toMatchObject({ ok: false, reason: "not_installed" });
    expect(await checkClipConsent(client({ error: { code: "500" } }) as never, ["a"], NOW)).toMatchObject({ ok: false, reason: "unreadable" });
    expect(await checkClipConsent(client({ data: "nope" }) as never, ["a"], NOW)).toMatchObject({ ok: false, reason: "unreadable" });
    expect(await checkClipConsent(client({ data: null }) as never, ["a"], NOW)).toMatchObject({ ok: false, reason: "unreadable" });
  });

  it("uses the academy's season, so late on 31 December in Durban is still that year", async () => {
    const c = client({ data: [] });
    await checkClipConsent(c as never, ["a"], new Date("2026-12-31T21:30:00Z")); // 23:30 SAST
    expect((c.calls[0].args as { p_season: string }).p_season).toBe("2026");
    await checkClipConsent(c as never, ["a"], new Date("2026-12-31T22:30:00Z")); // 00:30 SAST on 1 Jan
    expect((c.calls[1].args as { p_season: string }).p_season).toBe("2027");
  });
});

describe("consentBlockMessage", () => {
  const names = new Map([["a", "Sipho Dlamini"], ["b", "Bheki Zulu"], ["c", "Ayanda Nkosi"], ["d", "Thabo Mokoena"]]);
  it("uses first names only and shortens a long list", () => {
    expect(consentBlockMessage({ ok: false, reason: "missing_consent", blockedPlayerIds: ["a", "b"] }, names)).toBe(
      "Photo and media consent, or video analysis consent, is missing for Sipho, Bheki this season. Ask their parents to confirm it before using this clip.",
    );
    expect(consentBlockMessage({ ok: false, reason: "missing_consent", blockedPlayerIds: ["a", "b", "c", "d"] }, names)).toContain("Sipho, Bheki, Ayanda and 1 more");
    expect(consentBlockMessage({ ok: false, reason: "missing_consent", blockedPlayerIds: ["zz"] }, names)).toContain("A player");
  });
  it("names the migration when it is not installed, and never says consent was found", () => {
    expect(consentBlockMessage({ ok: false, reason: "not_installed", blockedPlayerIds: [] }, names)).toMatch(/migration 060/);
    expect(consentBlockMessage({ ok: false, reason: "unreadable", blockedPlayerIds: [] }, names)).toMatch(/nothing was sent/);
    expect(consentBlockMessage({ ok: false, reason: "no_players", blockedPlayerIds: [] }, names)).toMatch(/which players/);
  });
});

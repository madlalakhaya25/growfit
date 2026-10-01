import { FORMATIONS } from "../formations";
import {
  buildPlayRolesBrief, collectRolePlayers, playRolesHash, roleForPlayer, validatePlayRoles,
} from "../play-roles";

const f = FORMATIONS.find((x) => x.id === "11-4-3-3")!;
const tok = (i: number, playerId?: string) => ({
  id: `t${i}`, kind: "player" as const, x: f.slots[i].x, y: f.slots[i].y,
  label: f.slots[i].role.toUpperCase(), group: "Defender", ...(playerId ? { playerId } : {}),
});
const lb = f.slots.findIndex((s) => s.role === "lb");
const tokens = f.slots.map((_, i) => tok(i, i === lb ? "p-lb" : i === 5 ? "p-cm" : undefined));
const shapes = [
  { id: "s1", kind: "run" as const, pts: [{ x: f.slots[lb].x, y: f.slots[lb].y }, { x: 8, y: 50 }] },
];
const roster = [
  { id: "p-lb", full_name: "Sipho Dlamini", date_of_birth: "2014-03-01", position: "lb" },
  { id: "p-cm", full_name: "Thabo Nkosi", date_of_birth: "2014-05-01", position: "cm" },
];
const now = new Date("2026-10-01T00:00:00Z");

describe("collectRolePlayers", () => {
  it("returns only named players who have a drawn job", () => {
    const players = collectRolePlayers({ tokens, shapes }, roster, now);
    expect(players.map((p) => p.playerId)).toEqual(["p-lb"]);
    expect(players[0]).toMatchObject({ name: "Sipho", age: 12, position: "lb" });
    expect(players[0].jobs[0]).toMatch(/Run \d+m/);
  });
  it("skips a token whose player is not on the roster, and tolerates junk data", () => {
    expect(collectRolePlayers({ tokens, shapes }, [], now)).toEqual([]);
    expect(collectRolePlayers(null, roster, now)).toEqual([]);
    expect(collectRolePlayers({ tokens: "x", shapes: 3 }, roster, now)).toEqual([]);
  });
  it("gives a null age when there is no birthdate", () => {
    const p = collectRolePlayers({ tokens, shapes }, [{ ...roster[0], date_of_birth: null }], now);
    expect(p[0].age).toBeNull();
  });
  it("is sorted by player id so the brief is stable", () => {
    const two = [
      ...shapes,
      { id: "s2", kind: "pass" as const, pts: [{ x: f.slots[5].x, y: f.slots[5].y }, { x: 50, y: 30 }] },
    ];
    const ids = collectRolePlayers({ tokens, shapes: two }, roster, now).map((p) => p.playerId);
    expect(ids).toEqual([...ids].sort());
  });
});

describe("buildPlayRolesBrief and playRolesHash", () => {
  const players = collectRolePlayers({ tokens, shapes }, roster, now);
  it("is deterministic and includes each player's age and jobs", () => {
    const a = buildPlayRolesBrief({ name: "Press", conceptLabels: ["B", "A"] }, players);
    expect(a).toBe(buildPlayRolesBrief({ name: "Press", conceptLabels: ["A", "B"] }, players));
    expect(a).toContain("p-lb | Sipho | age 12");
    expect(a).toContain("Learning to Train");
  });
  it("hashes the play as players see it, whatever the concept order", () => {
    const h = playRolesHash({ name: "Press", conceptIds: ["a", "b"] }, players);
    expect(h).toBe(playRolesHash({ name: "Press", conceptIds: ["b", "a"] }, players));
    expect(h).not.toBe(playRolesHash({ name: "Press 2", conceptIds: ["a", "b"] }, players));
    const moved = collectRolePlayers({ tokens, shapes: [{ ...shapes[0], pts: [shapes[0].pts[0], { x: 90, y: 20 }] }] }, roster, now);
    expect(playRolesHash({ name: "Press", conceptIds: ["a", "b"] }, moved)).not.toBe(h);
  });
});

describe("validatePlayRoles", () => {
  it("keeps one clean entry per asked-about player", () => {
    const out = validatePlayRoles({
      roles: [
        { playerId: "p1", text: "**Run** down the left." },
        { playerId: "p1", text: "second one for the same player" },
        { playerId: "stranger", text: "not asked about" },
        { playerId: "p2", text: "   " },
        { playerId: "p3" },
        null,
      ],
    }, ["p1", "p2", "p3"]);
    expect(out).toEqual([{ playerId: "p1", text: "Run down the left." }]);
  });
  it("bounds length and tolerates a bad reply", () => {
    expect(validatePlayRoles({ roles: [{ playerId: "p1", text: "a".repeat(5000) }] }, ["p1"])[0].text.length).toBeLessThanOrEqual(420);
    expect(validatePlayRoles(null, ["p1"])).toEqual([]);
    expect(validatePlayRoles({ roles: "no" }, ["p1"])).toEqual([]);
  });
});

describe("roleForPlayer", () => {
  it("finds a player's own text and nobody else's", () => {
    const data = { roles: [{ playerId: "p1", text: "mine" }] };
    expect(roleForPlayer(data, "p1")).toBe("mine");
    expect(roleForPlayer(data, "p2")).toBeNull();
    expect(roleForPlayer(null, "p1")).toBeNull();
  });
});

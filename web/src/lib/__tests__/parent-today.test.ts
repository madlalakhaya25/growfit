import { DOCUMENTS } from "@/lib/document-definitions";
import { formsToSign, nextEventFor, type TodayEvent } from "@/lib/parent-today";

const now = new Date("2026-10-07T10:00:00Z");
const ev = (over: Partial<TodayEvent>): TodayEvent => ({
  kind: "training", teamId: "a", title: "Training", at: "2026-10-08T15:00:00Z", place: null, ...over,
});

describe("nextEventFor", () => {
  it("picks the earliest upcoming event for the child's teams", () => {
    const e = nextEventFor(
      [ev({ title: "late", at: "2026-10-12T08:00:00Z" }), ev({ title: "soon", at: "2026-10-08T15:00:00Z" })],
      new Set(["a"]),
      now,
    );
    expect(e?.title).toBe("soon");
  });
  it("ignores other teams, past events and cancelled fixtures", () => {
    const e = nextEventFor(
      [
        ev({ title: "other team", teamId: "b", at: "2026-10-07T12:00:00Z" }),
        ev({ title: "past", at: "2026-10-06T12:00:00Z" }),
        ev({ title: "cancelled", kind: "match", at: "2026-10-07T13:00:00Z", cancelled: true }),
        ev({ title: "real", at: "2026-10-09T12:00:00Z" }),
      ],
      new Set(["a"]),
      now,
    );
    expect(e?.title).toBe("real");
  });
  it("is null when nothing is coming up", () => {
    expect(nextEventFor([], new Set(["a"]), now)).toBeNull();
    expect(nextEventFor([ev({ at: "2026-10-01T10:00:00Z" })], new Set(["a"]), now)).toBeNull();
  });
  it("ignores an unreadable date", () => {
    expect(nextEventFor([ev({ at: "not a date" })], new Set(["a"]), now)).toBeNull();
  });
});

describe("formsToSign", () => {
  const all = () => new Map(DOCUMENTS.map((d) => [d.type, d.uploadOnly ? "uploaded" : "signed"]));
  it("is empty when every form is in", () => {
    expect(formsToSign(all())).toEqual([]);
  });
  it("lists a form that is missing or needs renewal", () => {
    const m = all();
    m.delete(DOCUMENTS[0].type);
    m.set(DOCUMENTS[1].type, "needs_renewal");
    expect(formsToSign(m)).toEqual([DOCUMENTS[0].label, DOCUMENTS[1].label]);
  });
});

import { toDateTimeLocal } from "../fixture-fields";

describe("toDateTimeLocal", () => {
  it("round-trips a timestamp through the input and back unchanged", () => {
    // The bug this guards: `toISOString().slice(0, 16)` converts to UTC, so
    // in SAST (UTC+2) a 14:00 kickoff opens the edit form showing 12:00 —
    // and saving without touching the field walks the fixture two hours
    // earlier every single time anyone edits it.
    const original = new Date(2026, 8, 27, 14, 30); // 27 Sep 2026, 14:30 local
    const asInputValue = toDateTimeLocal(original.toISOString());

    // A datetime-local value is parsed as local time, which is how the
    // browser submits it and how Postgres receives it.
    expect(new Date(asInputValue).getTime()).toBe(original.getTime());
  });

  it("formats as the value a datetime-local input expects", () => {
    const value = toDateTimeLocal(new Date(2026, 0, 5, 9, 5).toISOString());
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(value).toBe("2026-01-05T09:05");
  });

  it("keeps the local wall-clock hour, not the UTC one", () => {
    const local = new Date(2026, 8, 27, 14, 30);
    expect(toDateTimeLocal(local.toISOString()).slice(11)).toBe("14:30");
  });
});

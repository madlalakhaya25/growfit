import { fakeSupabase, type FakeOp, type FakeReply } from "./fake-supabase";

export type RecordedFilter = { table: string; method: string; args: unknown[] };

/**
 * fakeSupabase plus a log of every builder call (eq, in, select, ...) per
 * table, for tests where the filter itself is the thing being fixed -- e.g.
 * "the delete only matches a play on a team this coach coaches". fakeSupabase
 * alone ignores filters by design.
 */
export function recordingSupabase(handler: (op: FakeOp) => FakeReply) {
  const f = fakeSupabase(handler);
  const filters: RecordedFilter[] = [];
  type Builder = Record<string, (...a: unknown[]) => unknown>;
  const client = {
    from(table: string) {
      const wrap = (target: Builder): unknown =>
        new Proxy(target, {
          get(t, method: string) {
            const v = t[method];
            if (method === "then") return v;
            return (...args: unknown[]) => {
              filters.push({ table, method, args });
              return wrap(v(...args) as Builder);
            };
          },
        });
      return wrap(f.client.from(table) as Builder);
    },
  };
  /** The args of every `method` call made on `table`, e.g. `filtersOn("tactic_plays", "eq")`. */
  const filtersOn = (table: string, method: string) =>
    filters.filter((r) => r.table === table && r.method === method).map((r) => r.args);
  return { calls: f.calls, client, filters, filtersOn };
}

/**
 * A chainable, thenable in-memory stand-in for the Supabase query builder, for
 * tests of actions and helpers that talk to the database.
 *
 * It does not interpret filters: the handler is told the table, the action
 * (select / insert / update / upsert / delete), the payload and whether `.single()` /
 * `.maybeSingle()` was called, and returns whatever that call should resolve
 * to. That is deliberate -- the point is to exercise the code's own decisions
 * (what it asks for, what it writes, what it does with each reply), not to
 * re-implement PostgREST. Anything RLS-related is proven against a real
 * PostgreSQL instead (docs/MIGRATION_RUNBOOK.md).
 */
export type FakeOp = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: Record<string, unknown>;
  one: boolean;
};
export type FakeReply = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number };

export function fakeSupabase(handler: (op: FakeOp) => FakeReply) {
  const calls: FakeOp[] = [];
  return {
    calls,
    client: {
      /** A stored-function call: the handler sees table `rpc:<name>` and the args as payload. */
      rpc(name: string, args?: Record<string, unknown>) {
        const op: FakeOp = { table: `rpc:${name}`, action: "select", payload: args, one: false };
        calls.push({ ...op });
        const r = handler(op);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
      },
      from(table: string) {
        const op: FakeOp = { table, action: "select", one: false };
        const chain: Record<string, unknown> = new Proxy({}, {
          get(_t, prop: string) {
            if (prop === "then") {
              return (resolve: (v: unknown) => void) => {
                calls.push({ ...op });
                const r = handler(op);
                resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null });
              };
            }
            if (prop === "insert" || prop === "update" || prop === "upsert") {
              return (p: Record<string, unknown>) => { op.action = prop; op.payload = p; return chain; };
            }
            if (prop === "delete") return () => { op.action = "delete"; return chain; };
            if (prop === "single" || prop === "maybeSingle") return () => { op.one = true; return chain; };
            return () => chain; // select, eq, in, is, gte, order, limit, or, ...
          },
        });
        return chain;
      },
    },
  };
}

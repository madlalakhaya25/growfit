import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

export interface AgentLink {
  label: string;
  href: string;
  /**
   * Words that, when they appear in the final answer, mean the answer cited
   * this row (a player's name, an opponent, a drill name). A link with no
   * `match` is not tied to a particular mention and is always offered.
   */
  match?: string[];
}

export interface AgentToolContext {
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  role: UserRole;
  academyId: string | null;
  /**
   * Teams this caller may work with. EVERY team-scoped tool must filter by
   * this. A coach's value is their coached teams; the agent route (step 2.2)
   * is responsible for supplying an admin's academy-wide team ids.
   */
  teamIds: string[];
}

export interface AgentTool<I = unknown, O = unknown> {
  name: string;
  /** Shown to the model. One sentence, says what it returns, not how. */
  description: string;
  /** Gemini FunctionDeclaration parameter schema. */
  parameters: Record<string, unknown>;
  /** Validate raw model args. Return null to reject — never throw. */
  parseInput(raw: unknown): I | null;
  /** Runs the same query the UI uses, under the caller's own session. */
  run(ctx: AgentToolContext, input: I): Promise<O>;
  /** Rows this result can cite, so the answer can deep-link. */
  links?(output: O): AgentLink[];
  /** Hard cap on rows returned, so one call can't fill the context. */
  maxRows: number;
}

/**
 * What the loop feeds back to the model. A failure is a result the model can
 * recover from ("that player isn't on your teams"), never a thrown exception
 * that kills the turn. `error` is always a fixed, provider-safe string.
 */
export type AgentToolResult =
  | { ok: true; data: unknown; links: AgentLink[] }
  | { ok: false; error: string };

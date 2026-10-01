import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LayoutGrid, ChevronRight, Sparkles, Film } from "lucide-react";
import { AgentStream } from "@/components/ai/agent-stream";
import { getCoachedTeamIds } from "@/lib/coached-teams";

const TACTICS_STARTERS = [
  "Explain pressing triggers for my age group.",
  "What does a number 6 do in a 4-3-3?",
  "How do we build out from the back against a high press?",
  "Give me a training idea for transitions.",
];

export default async function CoachTacticsPage() {
  // Pass the coach's team so concept advice can cite their real squad numbers.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: team } = user
    ? await supabase
        .from("teams")
        .select("id")
        .in("id", await getCoachedTeamIds(supabase, user.id))
        .eq("active", true)
        .order("name")
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tactics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a tactical concept and get an age-appropriate explanation, reference
          videos, and a ready-to-run training session — all grounded in the LTPD phase
          for your age group.
        </p>
      </div>

      <Link
        href="/dashboard/coach/tactics/board"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <LayoutGrid className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Open the Tactical Board</span>
          <span className="block text-xs text-muted-foreground">
            Set up your squad in a formation and draw runs &amp; passing lines.
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>

      <Link
        href="/dashboard/coach/tactics/film"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Film className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Break down a match play</span>
          <span className="block text-xs text-muted-foreground">
            Freeze a frame from a phone clip or a photo and draw over it, like a TV analyst.
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>

      <Link
        href="/dashboard/coach/assistant"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Ask the AI Coach Assistant</span>
          <span className="block text-xs text-muted-foreground">
            Squad-aware answers, a suggested XI, and match plans for your next fixture.
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>

      {/* Tactical concepts and positional roles are asked of the Growfit Agent
          now (it knows which team and which page the question came from),
          instead of two single-purpose panels with their own dropdowns. The
          player-facing "my position" explainer is separate and unchanged. */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Ask about tactics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explain a tactical concept or what a position does, pitched at the age group you coach.
          </p>
        </div>
        <AgentStream teamId={team?.id} page="tactics" starters={TACTICS_STARTERS} />
      </section>
    </div>
  );
}

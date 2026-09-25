"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CoachAssistantPanel, type AssistantTeam, type AssistantFixture } from "@/components/ai/coach-assistant-panel";
import { getAssistantContextAction } from "@/app/actions/coach-assistant";
import type { BoardPlayer } from "@/lib/board-model";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; teams: AssistantTeam[]; roster: Record<string, BoardPlayer[]>; fixtures: Record<string, AssistantFixture[]> }
  | { status: "error" };

/**
 * The single AI entry point promised in docs/AI_FEATURES_AND_IA.md Part 4:
 * one "Ask Growfit" button, open from any coach page, instead of an
 * assistant reachable only via a link buried on the Tactics page. Data is
 * fetched on first open (via `getAssistantContextAction`), not on every
 * page load — see assistant-context.ts's comment for why.
 */
export function AskGrowfitSheet() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    if (state.status !== "idle") return;
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        const context = await getAssistantContextAction();
        setState(context.error ? { status: "error" } : { status: "ready", ...context });
      } catch {
        setState({ status: "error" });
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleOpen}>
        <MessageSquareText className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Ask Growfit</span>
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ask Growfit">
        {(state.status === "idle" || state.status === "loading" || isPending) && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading your squad…
          </div>
        )}
        {state.status === "error" && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your squad. Try again in a moment.
          </p>
        )}
        {state.status === "ready" && state.teams.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            You don&apos;t have a team yet. Create one in the Squad tab and the assistant
            will have something to work with.
          </p>
        )}
        {state.status === "ready" && state.teams.length > 0 && (
          <CoachAssistantPanel teams={state.teams} fixtures={state.fixtures} roster={state.roster} />
        )}
      </Sheet>
    </>
  );
}

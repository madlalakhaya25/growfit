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
  | { status: "ready"; teams: AssistantTeam[]; roster: Record<string, BoardPlayer[]>; fixtures: Record<string, AssistantFixture[]>; fetchedAt: number }
  | { status: "error" };

/** A ready squad snapshot older than this is refetched on next open, rather
 * than kept forever — a coach who added a player or a fixture mid-session
 * would otherwise never see it reflected here without a hard reload. */
const STALE_MS = 60_000;

/**
 * The single AI entry point promised in docs/AI_FEATURES_AND_IA.md Part 4:
 * one "Ask Growfit" button, open from any coach page, instead of an
 * assistant reachable only via a link buried on the Tactics page. Data is
 * fetched on first open (via `getAssistantContextAction`), not on every
 * page load — see assistant-context.ts's comment for why.
 *
 * A dropped request used to be permanent for the rest of the session: once
 * `state.status` left `"idle"`, `handleOpen` never fetched again, so one bad
 * network blip on patchy pitch-side data disabled the assistant until a
 * hard reload. `load()` is now the one place that decides whether a fetch
 * is needed — on error, or once the last successful load is stale — and
 * both `handleOpen` and the error state's retry button call it.
 */
export function AskGrowfitSheet() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function load() {
    setState({ status: "loading" });
    startTransition(async () => {
      try {
        const context = await getAssistantContextAction();
        setState(
          context.error
            ? { status: "error" }
            : { status: "ready", ...context, fetchedAt: Date.now() }
        );
      } catch {
        setState({ status: "error" });
      }
    });
  }

  function handleOpen() {
    setOpen(true);
    const stale = state.status === "ready" && Date.now() - state.fetchedAt > STALE_MS;
    if (state.status === "idle" || state.status === "error" || stale) load();
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleOpen} aria-label="Ask Growfit">
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
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <p>Couldn&apos;t load your squad.</p>
            <Button size="sm" variant="outline" onClick={load}>Try again</Button>
          </div>
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

"use client";

import { useActionState } from "react";
import { Switch } from "@/components/ui/switch";
import type { FeatureKey } from "@/lib/features";

type ActionResult = { error?: string; success?: boolean } | null;

type Props = {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  initial: Record<FeatureKey, boolean>;
};

export function AcademyFeaturesForm({ action, initial }: Props) {
  const [state, dispatch, isPending] = useActionState(action, null);

  return (
    <form action={dispatch} className="space-y-3">
      <Switch
        name="coach_extras"
        defaultChecked={initial.coach_extras}
        label="Extra coach tools"
        description="Skill challenges, the drill Library and the Learn tab for coaches."
      />
      <Switch
        name="tactics"
        defaultChecked={initial.tactics}
        label="Tactics"
        description="The tactics board for coaches, and Plays for players."
      />
      <Switch
        name="film"
        defaultChecked={initial.film}
        label="Film"
        description="Match film review for coaches, alongside Fixtures."
      />
      <Switch
        name="assistant"
        defaultChecked={initial.assistant}
        label="Ask Growfit assistant"
        description="The AI assistant available to coaches."
      />
      <Switch
        name="agent"
        defaultChecked={initial.agent}
        label="Growfit Agent"
        description="The AI agent that looks things up across the squad, for coaches and admins."
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Feature settings saved.</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-h-9"
        >
          {isPending ? "Saving…" : "Save features"}
        </button>
        <button
          type="submit"
          name="simple"
          value="1"
          disabled={isPending}
          className="inline-flex min-h-11 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted disabled:opacity-50 sm:min-h-9"
        >
          Use the simple menu
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        The simple menu turns every feature above off, leaving coaches Today, Fixtures, Squad,
        Training, Posts and Settings. Welfare and Emergency always stay.
      </p>
    </form>
  );
}

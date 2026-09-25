"use client";

import { useActionState } from "react";
import { Switch } from "@/components/ui/switch";

type ActionResult = { error?: string; success?: boolean } | null;

type Props = {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  initial: { tactics: boolean; film: boolean; assistant: boolean };
};

export function AcademyFeaturesForm({ action, initial }: Props) {
  const [state, dispatch, isPending] = useActionState(action, null);

  return (
    <form action={dispatch} className="space-y-3">
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Feature settings saved.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save features"}
      </button>
    </form>
  );
}

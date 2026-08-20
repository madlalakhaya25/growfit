"use client";

import { useActionState } from "react";
import { updateMyRegistrationNumbers } from "@/app/actions/player";

type ActionResult = { error?: string; success?: boolean } | null;

async function action(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return updateMyRegistrationNumbers(formData);
}

export function PlayerIdentityForm({
  initial,
}: {
  /** Unused by the write itself — the update is scoped to the caller's own row. */
  playerId?: string;
  initial: { mysafa_number?: string | null; id_number?: string | null };
}) {
  const [state, dispatch, isPending] = useActionState(action, null);

  return (
    <form action={dispatch} className="space-y-4">

      <div className="space-y-1.5">
        <label htmlFor="mysafa_number" className="text-sm font-medium">
          MySAFA / GDFA registration number
        </label>
        <input
          id="mysafa_number"
          name="mysafa_number"
          type="text"
          defaultValue={initial?.mysafa_number ?? ""}
          placeholder="e.g. SA-2024-00123"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Issued by SAFA or your regional football association when you register as a player.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="id_number" className="text-sm font-medium">
          SA ID / birth certificate number
        </label>
        <input
          id="id_number"
          name="id_number"
          type="text"
          defaultValue={initial?.id_number ?? ""}
          placeholder="13-digit SA ID number"
          maxLength={13}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Used by your parent or guardian to link their account to your profile.
        </p>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Saved successfully.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { savePlayerExtendedInfo } from "@/app/actions/records";

type Props = {
  playerId: string;
  initial: {
    school?: string | null;
    home_address?: string | null;
    id_number?: string | null;
    mysafa_number?: string | null;
  };
};

type ActionResult = { error?: string; success?: boolean } | null;

async function formAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const playerId = formData.get("playerId") as string;
  const data = {
    school: formData.get("school") as string,
    home_address: formData.get("home_address") as string,
    id_number: formData.get("id_number") as string,
    mysafa_number: formData.get("mysafa_number") as string,
  };
  return savePlayerExtendedInfo(playerId, data);
}

export function ExtendedInfoForm({ playerId, initial }: Props) {
  const [state, dispatch, isPending] = useActionState(formAction, null);

  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="playerId" value={playerId} />

      <div className="space-y-1.5">
        <label htmlFor="school" className="text-sm font-medium">School</label>
        <input
          id="school"
          name="school"
          defaultValue={initial?.school ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="home_address" className="text-sm font-medium">Home address</label>
        <input
          id="home_address"
          name="home_address"
          defaultValue={initial?.home_address ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="id_number" className="text-sm font-medium">SA ID / birth cert number</label>
        <input
          id="id_number"
          name="id_number"
          defaultValue={initial?.id_number ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="mysafa_number" className="text-sm font-medium">MYSAFA/GDFA registration no.</label>
        <input
          id="mysafa_number"
          name="mysafa_number"
          defaultValue={initial?.mysafa_number ?? ""}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-green-600">Saved successfully.</p>
      )}

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

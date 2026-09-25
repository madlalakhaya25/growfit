"use client";

import { useActionState } from "react";
import { savePlayerConsents } from "@/app/actions/records";
import { formatDayMonthYear } from "@/lib/time";

type Props = {
  playerId: string;
  season: string;
  initial: Record<string, unknown> | null;
};

type ActionResult = { error?: string; success?: boolean } | null;

async function formAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const playerId = formData.get("playerId") as string;
  const season = formData.get("season") as string;
  const data = {
    participation_consent: formData.get("participation_consent") === "on",
    photo_consent: formData.get("photo_consent") === "on",
    transport_consent: formData.get("transport_consent") === "on",
    risk_acknowledged: formData.get("risk_acknowledged") === "on",
    signed_by: formData.get("signed_by") as string,
  };
  return savePlayerConsents(playerId, season, data);
}

export function ConsentsForm({ playerId, season, initial }: Props) {
  const [state, dispatch, isPending] = useActionState(formAction, null);

  const signedAt = initial?.signed_at as string | null ?? null;
  const signedBy = initial?.signed_by as string | null ?? null;

  return (
    <div className="space-y-4">
      {signedAt && signedBy && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700">
          Signed {formatDayMonthYear(signedAt)} by {signedBy}
        </div>
      )}

      <form action={dispatch} className="space-y-4">
        <input type="hidden" name="playerId" value={playerId} />
        <input type="hidden" name="season" value={season} />

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="participation_consent"
              name="participation_consent"
              defaultChecked={!!(initial?.participation_consent)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div>
              <label htmlFor="participation_consent" className="text-sm font-medium">Participation</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                I consent to my child participating in all Growfit training sessions, matches and academy events.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="photo_consent"
              name="photo_consent"
              defaultChecked={!!(initial?.photo_consent)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div>
              <label htmlFor="photo_consent" className="text-sm font-medium">Photo &amp; media</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Photos/videos may be used on official Growfit channels only, never with full name or location details.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="transport_consent"
              name="transport_consent"
              defaultChecked={!!(initial?.transport_consent)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div>
              <label htmlFor="transport_consent" className="text-sm font-medium">Transport</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                I consent to my child being transported to away fixtures in academy-arranged roadworthy vehicles.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="risk_acknowledged"
              name="risk_acknowledged"
              defaultChecked={!!(initial?.risk_acknowledged)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <div>
              <label htmlFor="risk_acknowledged" className="text-sm font-medium">Risk acknowledgement</label>
              <p className="text-xs text-muted-foreground mt-0.5">
                I acknowledge the inherent physical risks of participation and the academy&apos;s safety procedures.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signed_by" className="text-sm font-medium">Full name of parent/guardian signing</label>
          <input
            id="signed_by"
            name="signed_by"
            defaultValue={signedBy ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-green-600">Consents saved successfully.</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save consents"}
        </button>
      </form>
    </div>
  );
}

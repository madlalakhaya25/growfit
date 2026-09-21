"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createFixture } from "@/app/actions/fixtures";
import { FixtureFields, toDateTimeLocal } from "@/components/fixtures/fixture-fields";

export function NewFixtureForm({ teamId, backHref }: { teamId: string; backHref: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      (await createFixture(formData)) ?? null,
    null
  );

  // A week out, in the coach's own timezone — `toISOString().slice(0, 16)`
  // was UTC, so in SAST the prefilled kickoff read two hours earlier than it
  // should.
  //
  // Computed in a state initialiser rather than in the render body: reading
  // the clock during render is impure (React's purity rule flags it), and on
  // a Server Component pass it would also produce a different value than the
  // client's, so the prefilled date could flicker on hydration.
  const [defaultDate] = useState(() =>
    toDateTimeLocal(new Date(Date.now() + 7 * 86_400_000).toISOString())
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="team_id" value={teamId} />
      <FixtureFields defaults={{ fixtureDate: defaultDate, isHome: true }} />

      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create fixture"}
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

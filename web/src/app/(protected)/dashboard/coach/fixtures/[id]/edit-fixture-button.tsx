"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateFixture } from "@/app/actions/fixtures";
import {
  FixtureFields,
  toDateTimeLocal,
  type FixtureDefaults,
} from "@/components/fixtures/fixture-fields";

/**
 * Correct a scheduled fixture.
 *
 * Fixtures could be created, cancelled and result-logged, but never edited —
 * so a kickoff time typed wrong, or an opponent's name misspelt, could only
 * be fixed by cancelling (which tells every parent the match is off, and
 * demands a reason) and creating a new one.
 *
 * Only offered while the fixture is still upcoming. The server enforces the
 * same rule: a completed fixture has appearances and per-player ratings
 * hanging off it, and a cancelled one has already been announced as off.
 */
export function EditFixtureButton({
  fixtureId,
  fixture,
}: {
  fixtureId: string;
  fixture: {
    opponent: string;
    venue: string | null;
    fixture_date: string;
    is_home: boolean;
    notes: string | null;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaults: FixtureDefaults = {
    opponent: fixture.opponent,
    venue: fixture.venue,
    fixtureDate: toDateTimeLocal(fixture.fixture_date),
    isHome: fixture.is_home,
    notes: fixture.notes,
  };

  function handleSave(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateFixture(fixtureId, formData);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Fixture updated.");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      // onInk, not outline: this collapsed trigger sits directly on the
      // matchday header's bg-ink band (see page.tsx), which inverts
      // against the page rather than being fixed-dark, so outline's
      // page-tuned colours are backwards on it. The expanded form below is
      // a separate, opaque bg-card island floating on that same band, so
      // it keeps the ordinary variants.
      <Button size="sm" variant="onInk" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit
      </Button>
    );
  }

  return (
    <form
      action={handleSave}
      className="w-full space-y-5 rounded-xl border border-border bg-card p-4"
    >
      <p className="text-sm font-semibold">Edit fixture</p>
      <FixtureFields defaults={defaults} />

      <p className="text-xs text-muted-foreground">
        Players and parents see the change straight away. It doesn&apos;t send a
        new notification, so tell the squad yourself if the time has moved.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

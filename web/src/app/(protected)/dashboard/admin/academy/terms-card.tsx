"use client";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSuggestedTerms, saveTerm, deleteTerm } from "@/app/actions/terms";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface TermRow {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

function TermForm({ term }: Readonly<{ term: TermRow }>) {
  const [state, formAction, pending] = useActionState(saveTerm, null);
  const [removing, startRemove] = useTransition();
  const s = state as { error?: string; success?: boolean } | null;

  return (
    <form action={formAction} className="space-y-2 rounded-lg border border-border p-3">
      <input type="hidden" name="id" value={term.id} />
      <div className="grid gap-2 sm:grid-cols-3">
        <input name="name" defaultValue={term.name} aria-label="Term name" className={INPUT_CLASS} required maxLength={60} />
        <input name="starts_on" type="date" defaultValue={term.starts_on} aria-label="Starts" className={INPUT_CLASS} required />
        <input name="ends_on" type="date" defaultValue={term.ends_on} aria-label="Ends" className={INPUT_CLASS} required />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={removing}
          onClick={() =>
            startRemove(async () => {
              const res = await deleteTerm(term.id);
              if (res?.error) toast.error(res.error);
            })
          }
        >
          Delete
        </Button>
        {s?.error && <span role="alert" className="text-sm text-destructive">{s.error}</span>}
        {s?.success && <output className="text-sm text-green-600 dark:text-green-400">Saved</output>}
      </div>
    </form>
  );
}

export function TermsCard({ terms, year }: Readonly<{ terms: TermRow[]; year: number }>) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function setUp() {
    startTransition(async () => {
      const res = await createSuggestedTerms(year);
      if (res?.error) toast.error(res.error);
      else setNote(res?.approximate ? "These dates are an estimate. Check them against the school calendar." : null);
    });
  }

  return (
    <div className="space-y-4">
      {terms.length === 0 && (
        <p className="text-sm text-muted-foreground">No terms yet. One tap adds the four school terms for {year}.</p>
      )}
      <Button type="button" onClick={setUp} disabled={pending}>
        {pending ? "Adding…" : `Set up ${year} terms`}
      </Button>
      {note && <output className="block text-sm text-amber-600 dark:text-amber-400">{note}</output>}
      <div className="space-y-3">
        {terms.map((t) => <TermForm key={`${t.id}:${t.name}:${t.starts_on}:${t.ends_on}`} term={t} />)}
      </div>
    </div>
  );
}

"use client";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addCurriculumItem, moveCurriculumItem, setCurriculumItemActive } from "@/app/actions/curriculum";
import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META } from "@/lib/development-categories";
import { ageGroupsWithItems, curriculumIsEmpty, groupForAgeGroup, type CurriculumItem } from "@/lib/curriculum";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const DEFAULT_AGE_GROUPS = ["U11", "U13", "U15"];

function AddForm({ ageGroups }: Readonly<{ ageGroups: string[] }>) {
  const [state, formAction, pending] = useActionState(addCurriculumItem, null);
  const s = state as { error?: string; success?: boolean } | null;
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">Add to the curriculum</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="age_group" aria-label="Age group" className={INPUT_CLASS} required defaultValue="">
          <option value="" disabled>Age group</option>
          {ageGroups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select name="category" aria-label="Heading" className={INPUT_CLASS} required defaultValue="">
          <option value="" disabled>Heading</option>
          {MILESTONE_CATEGORIES.map((c) => <option key={c} value={c}>{MILESTONE_CATEGORY_META[c].label}</option>)}
        </select>
      </div>
      <input name="title" aria-label="What is taught" placeholder="What the academy teaches, in your words" className={INPUT_CLASS} required maxLength={200} />
      <textarea name="description" aria-label="Description (optional)" placeholder="Optional: what it looks like at this age" className={`${INPUT_CLASS} h-20`} maxLength={600} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
        {s?.error && <span role="alert" className="text-sm text-destructive">{s.error}</span>}
        {s?.success && <output className="text-sm text-green-600 dark:text-green-400">Added</output>}
      </div>
    </form>
  );
}

function ItemRow({ item, first, last }: Readonly<{ item: CurriculumItem; first: boolean; last: boolean }>) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
    });
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" size="sm" variant="outline" disabled={pending || first} aria-label={`Move up: ${item.title}`} onClick={() => run(() => moveCurriculumItem(item.id, "up"))}>↑</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending || last} aria-label={`Move down: ${item.title}`} onClick={() => run(() => moveCurriculumItem(item.id, "down"))}>↓</Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => setCurriculumItemActive(item.id, false))}>Retire</Button>
      </div>
    </li>
  );
}

export function CurriculumCard({ items }: Readonly<{ items: CurriculumItem[] }>) {
  const [pending, startTransition] = useTransition();
  const written = ageGroupsWithItems(items);
  const ageGroups = [...new Set([...DEFAULT_AGE_GROUPS, ...written])];
  const retired = items.filter((i) => !i.active);

  return (
    <div className="space-y-6">
      {curriculumIsEmpty(items) && (
        <p className="rounded-md bg-muted px-3 py-3 text-sm">
          <strong>Buhle: start here.</strong> Nothing is written yet. Add what the academy teaches at each age, under the five headings.
          Coaches will see this list; nothing is added for you.
        </p>
      )}

      {written.map((ageGroup) => (
        <section key={ageGroup} className="space-y-3">
          <h3 className="text-base font-semibold">{ageGroup}</h3>
          {groupForAgeGroup(items, ageGroup).map((group) => (
            <div key={group.category} className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">{MILESTONE_CATEGORY_META[group.category].label}</h4>
              {group.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing yet.</p>
              ) : (
                <ul className="space-y-1">
                  {group.items.map((item, i) => (
                    <ItemRow key={item.id} item={item} first={i === 0} last={i === group.items.length - 1} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}

      <AddForm ageGroups={ageGroups} />

      {retired.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Retired ({retired.length})</summary>
          <ul className="mt-2 space-y-1">
            {retired.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <span>{item.ageGroup}, {MILESTONE_CATEGORY_META[item.category].label}: {item.title}</span>
                <Button
                  type="button" size="sm" variant="outline" disabled={pending}
                  onClick={() => startTransition(async () => {
                    const res = await setCurriculumItemActive(item.id, true);
                    if (res?.error) toast.error(res.error);
                  })}
                >
                  Bring back
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCurriculumLinks } from "@/app/actions/curriculum-links";
import { MILESTONE_CATEGORY_META } from "@/lib/development-categories";
import type { CurriculumGroup } from "@/lib/curriculum";

/**
 * "What is this about?": the academy's own curriculum items for the team's age
 * group, tick any that apply. Optional, so a coach is never blocked by it.
 * Renders nothing when the academy has written no items for this age group.
 */
export function CurriculumPicker({
  linkType, linkId, groups, initialIds, title = "What is this about?",
}: Readonly<{
  linkType: "session" | "objective";
  linkId: string;
  groups: CurriculumGroup[];
  initialIds: string[];
  title?: string;
}>) {
  const [chosen, setChosen] = useState<string[]>(initialIds);
  const [saved, setSaved] = useState<string[]>(initialIds);
  const [pending, startTransition] = useTransition();

  if (groups.every((g) => g.items.length === 0)) return null;

  const dirty = chosen.length !== saved.length || chosen.some((id) => !saved.includes(id));
  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  function save() {
    startTransition(async () => {
      const res = await setCurriculumLinks(linkType, linkId, chosen);
      if (res?.error) { toast.error(res.error); return; }
      setSaved(chosen);
      toast.success("Saved");
    });
  }

  return (
    <details className="rounded-xl border border-border bg-card p-4" open={initialIds.length > 0}>
      <summary className="cursor-pointer text-base font-semibold">
        {title}
        {saved.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">{saved.length} chosen</span>}
      </summary>
      <div className="mt-3 space-y-3">
        {groups.filter((g) => g.items.length > 0).map((g) => (
          <fieldset key={g.category} className="space-y-1">
            <legend className="text-sm font-medium text-muted-foreground">{MILESTONE_CATEGORY_META[g.category].label}</legend>
            {g.items.map((item) => (
              <label key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={chosen.includes(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span>{item.title}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <Button type="button" size="sm" disabled={pending || !dirty} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </details>
  );
}

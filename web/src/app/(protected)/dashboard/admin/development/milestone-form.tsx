"use client";
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveMilestoneTemplate, deleteMilestoneTemplate } from "@/app/actions/development";
import type { MilestoneCategory, MilestoneTemplateData } from "@/app/actions/development";
import { POSITIONS, AGE_GROUPS } from "@/lib/types";
import type { Position } from "@/lib/types";

const CATEGORIES: MilestoneCategory[] = ["technical", "tactical", "physical", "mental", "leadership"];

const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  technical: "Technical",
  tactical: "Tactical",
  physical: "Physical",
  mental: "Mental",
  leadership: "Leadership",
};

const CATEGORY_STYLES: Record<MilestoneCategory, string> = {
  technical: "bg-blue-500/15 text-blue-700 border-transparent",
  tactical: "bg-violet-500/15 text-violet-700 border-transparent",
  physical: "bg-orange-500/15 text-orange-700 border-transparent",
  mental: "bg-teal-500/15 text-teal-700 border-transparent",
  leadership: "bg-amber-500/15 text-amber-700 border-transparent",
};

function inputCls() {
  return "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
}

type TemplateRow = MilestoneTemplateData & { id: string };

function MilestoneRow({ template, academyId }: { template: TemplateRow; academyId: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveMilestoneTemplate(academyId, {
        id: template.id,
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        category: formData.get("category") as MilestoneCategory,
        position: (formData.get("position") as Position | "") || null,
        age_group: (formData.get("age_group") as string | "") || null,
        sort_order: Number(formData.get("sort_order") ?? 0),
      });
      if (res?.error) { setError(res.error); return; }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete milestone "${template.title}"?`)) return;
    start(async () => {
      await deleteMilestoneTemplate(template.id);
    });
  }

  if (editing) {
    return (
      <form action={handleSave} className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <input name="title" defaultValue={template.title} required placeholder="Title" className={inputCls()} />
          </div>
          <div className="sm:col-span-2">
            <textarea
              name="description"
              defaultValue={template.description}
              rows={2}
              placeholder="Description"
              className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <select aria-label="Category" name="category" defaultValue={template.category} required className={inputCls()}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <select aria-label="Position" name="position" defaultValue={template.position ?? ""} className={inputCls()}>
            <option value="">All positions</option>
            {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select aria-label="Age group" name="age_group" defaultValue={template.age_group ?? ""} className={inputCls()}>
            <option value="">All age groups</option>
            {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <input
            name="sort_order"
            type="number"
            defaultValue={template.sort_order}
            placeholder="Sort order"
            className={inputCls()}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            <Check className="size-3.5" aria-hidden="true" />
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-3.5" aria-hidden="true" />
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm">{template.title}</p>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${CATEGORY_STYLES[template.category]}`}>
            {CATEGORY_LABELS[template.category]}
          </span>
        </div>
        {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
        <div className="flex gap-2 text-xs text-muted-foreground">
          {template.position && <span className="capitalize">{template.position}</span>}
          {template.position && template.age_group && <span>·</span>}
          {template.age_group && <span>{template.age_group}</span>}
          {!template.position && !template.age_group && <span>All players</span>}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={handleDelete}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function AddMilestoneForm({ academyId }: { academyId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveMilestoneTemplate(academyId, {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        category: formData.get("category") as MilestoneCategory,
        position: (formData.get("position") as Position | "") || null,
        age_group: (formData.get("age_group") as string | "") || null,
        sort_order: Number(formData.get("sort_order") ?? 0),
      });
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Add milestone
      </Button>
    );
  }

  return (
    <form action={handleAdd} className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">New milestone</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input name="title" required placeholder="Title" className={inputCls()} />
        </div>
        <div className="sm:col-span-2">
          <textarea
            name="description"
            rows={2}
            placeholder="Description"
            className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select aria-label="Category" name="category" required defaultValue="" className={inputCls()}>
          <option value="" disabled>Category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select aria-label="Position" name="position" defaultValue="" className={inputCls()}>
          <option value="">All positions</option>
          {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select aria-label="Age group" name="age_group" defaultValue="" className={inputCls()}>
          <option value="">All age groups</option>
          {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input
          name="sort_order"
          type="number"
          defaultValue={0}
          placeholder="Sort order"
          className={inputCls()}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          {pending ? "Saving…" : "Save milestone"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function MilestoneManager({
  academyId,
  templates,
}: {
  academyId: string;
  templates: TemplateRow[];
}) {
  const grouped = CATEGORIES.reduce<Record<MilestoneCategory, TemplateRow[]>>(
    (acc, cat) => {
      acc[cat] = templates.filter((t) => t.category === cat).sort((a, b) => a.sort_order - b.sort_order);
      return acc;
    },
    { technical: [], tactical: [], physical: [], mental: [], leadership: [] }
  );

  return (
    <div className="space-y-8">
      <AddMilestoneForm academyId={academyId} />

      {CATEGORIES.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABELS[cat]}
              </h2>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[cat]}`}>
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <MilestoneRow key={t.id} template={t} academyId={academyId} />
              ))}
            </div>
          </section>
        );
      })}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">No milestones yet. Add one above to get started.</p>
      )}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTeam, deleteTeam } from "@/app/actions/squad";
import { AGE_GROUPS } from "@/lib/types";

export function TeamActions({
  teamId,
  name,
  ageGroup,
}: {
  teamId: string;
  name: string;
  ageGroup: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateTeam(teamId, formData);
      if (res?.error) { setError(res.error); return; }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    start(async () => { await deleteTeam(teamId); });
  }

  if (editing) {
    return (
      <form action={handleSave} className="space-y-2 pt-1">
        <input
          name="name"
          defaultValue={name}
          required
          placeholder="Team name"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          aria-label="Age group"
          name="age_group"
          defaultValue={ageGroup}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No age group</option>
          {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
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
    <div className="flex gap-2 pt-1">
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={handleDelete}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
        <Trash2 className="size-3.5" aria-hidden="true" />
        Delete
      </Button>
    </div>
  );
}

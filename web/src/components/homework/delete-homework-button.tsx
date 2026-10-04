"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteHomework } from "@/app/actions/homework";

export function DeleteHomeworkButton({ id, title }: Readonly<{ id: string; title: string }>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      <button
        type="button"
        disabled={pending}
        aria-label={`Delete homework ${title}`}
        onClick={() => {
          if (!globalThis.confirm(`Delete "${title}" and everyone's answers?`)) return;
          start(async () => {
            const res = await deleteHomework(id);
            setError(res.error ?? null);
          });
        }}
        className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </span>
  );
}

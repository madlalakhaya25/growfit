"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { updateAnnouncement, deleteAnnouncement } from "@/app/actions/announcements";
import { cn } from "@/lib/utils";

/**
 * Edit / delete controls for one announcement.
 *
 * Announcements could be created and deleted but never edited, so fixing a
 * typo in a post that had already reached every parent meant deleting it and
 * posting again — which re-notifies everyone and throws away the read
 * receipts the coach was looking at.
 *
 * The display markup stays a Server Component and arrives as `children`, so
 * only the editing state lives on the client. Same toggle shape as
 * `TeamActions` and the milestone card.
 */
export function AnnouncementActions({
  id,
  title,
  body,
  children,
}: {
  id: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  function handleSave(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await updateAnnouncement(id, formData);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Announcement updated.");
      setEditing(false);
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      body: "Parents and players who have already seen it keep no copy, and this cannot be undone.",
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteAnnouncement(id);
      if (res?.error) toast.error(res.error);
    });
  }

  if (editing) {
    return (
      <form action={handleSave} className="min-w-0 flex-1 space-y-2">
        <input
          name="title"
          defaultValue={title}
          required
          maxLength={100}
          aria-label="Announcement title"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <textarea
          name="body"
          defaultValue={body}
          required
          maxLength={2000}
          rows={4}
          aria-label="Announcement message"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {/* The team is deliberately not editable — moving a post to another
            squad would silently change who it was addressed to after people
            have already read it. */}
        <p className="text-xs text-muted-foreground">
          Editing the message won&apos;t re-notify anyone. To send it to a different
          team, delete this and post a new one.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={pending}>
            <Check className="size-3.5" aria-hidden="true" />
            Save
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

  return (
    <>
      {dialog}
      {children}
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit announcement: ${title}`}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
          )}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label={`Delete announcement: ${title}`}
          className={cn(
            "shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
            pending && "opacity-50 cursor-wait"
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

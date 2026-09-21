"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteMedia } from "@/app/actions/media";
import { cn } from "@/lib/utils";

interface MediaItem {
  id: string;
  url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  tagged_players?: { full_name: string }[];
  /** Who uploaded it — RLS lets only that person delete it. */
  uploaded_by?: string | null;
}

interface Props {
  items: MediaItem[];
  /**
   * Show a delete control on each item.
   *
   * `deleteMedia()` has existed since the media feature shipped and the
   * gallery had an `onDelete` prop for it — but not one of the three call
   * sites ever passed it, so a photo or video of a child could be uploaded
   * and then never removed through the app at all. For an academy holding
   * media of minors under POPIA that is a records problem, not a missing
   * convenience.
   *
   * Handled here rather than through a callback because every page that
   * renders this is a Server Component and cannot pass one. Authorisation
   * is the server action's job, and RLS's underneath it.
   */
  canDelete?: boolean;
  /**
   * The viewer's id. RLS on media_uploads is `uploaded_by = auth.uid()`
   * (migration 008), so only the uploader can actually delete an item.
   * Passing this means the control appears exactly where it will work,
   * rather than on every tile and failing on most of them.
   */
  currentUserId?: string;
}

export function MediaGallery({ items, canDelete, currentUserId }: Props) {
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function handleDelete(item: MediaItem) {
    const ok = await confirm({
      title: `Delete this ${item.media_type === "photo" ? "photo" : "video"}?`,
      body: item.caption
        ? `"${item.caption}" will be removed from the album and from storage. This cannot be undone.`
        : "It will be removed from the album and from storage. This cannot be undone.",
    });
    if (!ok) return;

    start(async () => {
      const res = await deleteMedia(item.id);
      if (res?.error) toast.error(res.error);
      else toast.success("Deleted.");
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {dialog}
      {items.map((item) => (
        <div key={item.id} className="relative group space-y-1.5">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            {item.media_type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.caption ?? "Media"}
                className="size-full object-cover"
              />
            ) : (
              <video
                src={item.url}
                controls
                className="size-full rounded-xl object-cover"
                style={{ maxHeight: "240px" }}
              />
            )}

            {canDelete && currentUserId && item.uploaded_by === currentUserId && (
              <button
                type="button"
                onClick={() => handleDelete(item)}
                disabled={pending}
                /* Was `opacity-0 group-hover:opacity-100`, i.e. invisible on
                   any touch device — which is most of this academy. Shown
                   outright on touch, revealed on hover only where hovering
                   is possible. */
                className={cn(
                  "absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  "lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100",
                  pending && "opacity-50 cursor-wait"
                )}
                aria-label={`Delete ${item.media_type === "photo" ? "photo" : "video"}${item.caption ? `: ${item.caption}` : ""}`}
              >
                {/* Trash, not an X: an X on a thumbnail reads as "close
                    this preview", not "delete this permanently". */}
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {item.caption && (
            <p className="text-xs text-muted-foreground leading-snug px-0.5 truncate">
              {item.caption}
            </p>
          )}

          {item.tagged_players && item.tagged_players.length > 0 && (
            <div className="flex flex-wrap gap-1 px-0.5">
              {item.tagged_players.map((p) => (
                <Badge key={p.full_name} variant="brand" className="text-[10px] px-1.5 py-0">
                  {p.full_name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

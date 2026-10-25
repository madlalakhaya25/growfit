"use client";

import { useState } from "react";
import { MoreHorizontal, ClipboardCheck, MessageSquareText, Target, ShieldAlert, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { ListRow } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { CopyInviteLinkButton } from "@/components/copy-invite-link-button";

/**
 * The squad's less frequent tools behind one "More" button. They were six
 * outline buttons above the list, which on a phone pushed the first player
 * below the fold before the coach had found anyone.
 */
export function SquadToolsMenu({ teamId, inviteCode }: Readonly<{ teamId: string; inviteCode: string }>) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const tools = [
    { href: `/dashboard/coach/squad/review?team=${teamId}`, label: "Term review", sub: "Write each player's end-of-term notes", Icon: ClipboardCheck, tone: "blue" as const },
    { href: `/dashboard/coach/squad/digest?team=${teamId}`, label: "Weekly notes", sub: "A short update for families", Icon: MessageSquareText, tone: "teal" as const },
    { href: `/dashboard/coach/squad/plans?team=${teamId}`, label: "Plans", sub: "Development goals per player", Icon: Target, tone: "purple" as const },
    { href: `/dashboard/coach/squad/emergency?team=${teamId}`, label: "Emergency contacts", sub: "Who to call, and medical notes", Icon: ShieldAlert, tone: "red" as const },
    { href: `/dashboard/coach/squad/import?team=${teamId}`, label: "Import players", sub: "From a spreadsheet", Icon: Upload, tone: "grey" as const },
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More squad tools"
        aria-haspopup="dialog"
        className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted lg:size-9"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={close} title="Squad tools">
        <div className="space-y-4">
          <div className="divide-y divide-hairline">
            {tools.map(({ href, label, sub, Icon, tone }) => (
              <ListRow
                key={href}
                href={href}
                onClick={close}
                leading={<IconTile tone={tone}><Icon aria-hidden="true" /></IconTile>}
                title={label}
                subtitle={sub}
                className="first:pt-3 last:pb-3"
              />
            ))}
          </div>
          <div className="border-t border-hairline pt-4">
            <p className="mb-2 text-sm text-muted-foreground">Invite a family to join this squad</p>
            <CopyInviteLinkButton inviteCode={inviteCode} />
          </div>
        </div>
      </Sheet>
    </>
  );
}

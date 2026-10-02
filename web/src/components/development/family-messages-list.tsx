import type { FamilyMessage } from "@/lib/family-messages";

/**
 * What the coaches have chosen to share: match stories now, the weekly digest
 * next. Approved messages only (the loader asks for nothing else). Renders
 * nothing when there are none, so a family with no stories sees no empty box.
 */
export function FamilyMessagesList({ messages, heading = "From the coaches" }: Readonly<{ messages: FamilyMessage[]; heading?: string }>) {
  if (messages.length === 0) return null;
  return (
    <section className="space-y-2" aria-label={heading}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <ul className="space-y-2">
        {messages.map((m) => (
          <li key={m.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm">{m.body}</p>
            {m.approvedByName && <p className="mt-1 text-xs text-muted-foreground">{m.approvedByName}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

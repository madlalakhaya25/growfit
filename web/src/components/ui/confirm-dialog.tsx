"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * In-app confirmation for destructive actions, replacing `window.confirm()`.
 *
 * Six destructive actions used the browser's own dialog — removing a player
 * from a squad, deleting a team, a milestone, a training session or an
 * announcement, and revoking a parent's access to their child's records. The
 * native dialog is a poor fit for all of them:
 *
 *  - It is unstyled and says "localhost:3000 says", which reads like a
 *    browser warning rather than a decision the academy is asking someone to
 *    make about a child's record.
 *  - It cannot distinguish a destructive action from a routine one. "OK" and
 *    "Cancel" are the only labels available, so the button that permanently
 *    deletes something looks exactly like the button that dismisses a notice.
 *  - It blocks the main thread and some mobile browsers suppress it entirely
 *    after repeated use, which silently turns a guarded action into an
 *    unguarded one.
 *
 * The API is deliberately promise-based so each call site keeps its existing
 * shape: `if (!confirm(...)) return;` becomes `if (!(await confirm({...})))
 * return;` and nothing else about the handler changes.
 */
export interface ConfirmOptions {
  title: string;
  /** The consequence, in plain language. Say what is lost, not "are you sure". */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. Default true — every current
   *  caller is a delete or a revoke. */
  destructive?: boolean;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    []
  );

  const close = useCallback(
    (confirmed: boolean) => {
      setPending((current) => {
        current?.resolve(confirmed);
        return null;
      });
    },
    []
  );

  const dialog = pending ? (
    <ConfirmDialog options={pending.options} onResolve={close} />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  options,
  onResolve,
}: {
  options: ConfirmOptions;
  onResolve: (confirmed: boolean) => void;
}) {
  const {
    title,
    body,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    destructive = true,
  } = options;

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus when the dialog opened, so it can be handed back.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    // Focus lands on Cancel, not Confirm: for a destructive dialog the safe
    // option should be the one a stray Enter or Space hits.
    cancelRef.current?.focus();

    // The page behind must not scroll while a modal is open — on a phone
    // that reads as the dialog having been dismissed.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onResolve(false);
        return;
      }
      if (event.key !== "Tab") return;

      // Keep Tab inside the dialog. Without this, tabbing walks into the
      // page behind it, where a click would act on a surface the person
      // cannot see.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onResolve]);

  // Portalled to <body> so a dialog opened from inside a card with
  // `overflow-hidden` or its own stacking context still covers the page.
  //
  // No "mounted" gate: this component only ever renders as the result of a
  // click, so the server always renders `dialog === null` and never reaches
  // here. An earlier version did gate on a mounted flag, and it was a real
  // bug — the first render returned null, so the panel's refs did not exist
  // when the focus effect ran and focus never moved to Cancel. The guard
  // below covers the theoretical non-browser render without that ordering
  // hazard.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      // Clicking the backdrop cancels — but only the backdrop itself, not a
      // click that started inside the panel and drifted out.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={body ? "confirm-dialog-body" : undefined}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        {body && (
          <p id="confirm-dialog-body" className="mt-2 text-sm text-muted-foreground">
            {body}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onResolve(false)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

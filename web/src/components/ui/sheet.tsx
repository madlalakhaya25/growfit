"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * A bottom sheet on mobile, a right-hand side panel on desktop (the
 * `sm:` breakpoint switches it) — one component for "Ask Growfit", the
 * quick-actions menu, and any other overlay that used to be its own page.
 *
 * No @radix-ui/react-dialog dependency: this app already ships its own
 * `ConfirmDialog`-style overlays, and a second dialog primitive with a
 * different focus-trap implementation would be worse than one simple one.
 * Keeps its own escape-key handling, backdrop click-to-close, and a
 * (single-direction) focus trap — good enough for a sheet with a handful
 * of interactive elements, not a general-purpose dialog library.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <div
        className="absolute inset-0 bg-ink/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[85vh] w-full flex-col rounded-t-xl bg-card shadow-lg outline-none",
          "sm:h-full sm:max-h-full sm:w-full sm:max-w-sm sm:rounded-t-none",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

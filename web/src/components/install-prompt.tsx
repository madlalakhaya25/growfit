"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Reads a browser API to sync into state -- window/navigator/
    // sessionStorage aren't available during SSR, so this legitimately
    // needs a real client-side pass to know the true value; there's no way
    // to compute it during the server render. This is React's own
    // documented purpose for an effect ("synchronize with an external
    // system"), applied to the browser environment itself rather than a
    // subscription -- the one-render cost is the price of not guessing at
    // a value the server genuinely cannot know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);
    setDismissed(sessionStorage.getItem("pwa-prompt-dismissed") === "1");

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setDismissed(true);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    dismiss();
  }

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted || isStandalone || dismissed) return null;

  // Android / desktop: show native install banner
  if (deferredPrompt) {
    return (
      <div
        role="banner"
        className={cn(
          "fixed bottom-20 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg lg:bottom-4 lg:left-auto lg:right-6 lg:max-w-sm"
        )}
      >
        <Image src="/growfit.png" alt="Growfit FA" width={40} height={40} className="shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight">Install Growfit FA</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add to home screen for the best experience</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" onClick={handleInstall}>
            <Download className="size-3.5" aria-hidden="true" />
            Install
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // iOS: show manual instructions
  if (isIOS) {
    return (
      <div
        role="banner"
        className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-border bg-card p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-sm">Install Growfit FA</p>
            <p className="text-xs text-muted-foreground">
              Tap the{" "}
              <Share className="inline size-3.5 align-text-bottom" aria-hidden="true" />{" "}
              <strong>Share</strong> button, then{" "}
              <strong>&ldquo;Add to Home Screen&rdquo;</strong> to install.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

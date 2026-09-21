"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { issueCalendarToken } from "@/app/actions/calendar";

/**
 * Subscribe-to-calendar control.
 *
 * The point of the feed is that it is set up once and then never thought
 * about again: fixtures, training and any time change land in the calendar
 * app the person already uses, and keep working when their phone has no
 * signal. That only holds if the URL is a *subscription*, not a download, so
 * the copy here is explicit about the difference — a downloaded .ics is a
 * one-off snapshot that will silently go stale.
 *
 * The URL is a bearer credential: anyone holding it gets the schedule. It is
 * therefore minted on request rather than at signup, and "Reset link" is the
 * revoke path — rotating immediately stops the old URL resolving.
 */
export function CalendarSubscribeCard({
  initialToken,
}: {
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  // Built in the browser so the link matches whatever host the person is
  // actually on — a hardcoded production URL would be wrong on a preview
  // deployment and unusable in local development.
  const feedUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}.ics`
      : null;

  function generate(rotate: boolean) {
    start(async () => {
      const res = await issueCalendarToken(rotate);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setToken(res.token ?? null);
      setCopied(false);
      toast.success(rotate ? "New link created. The old one no longer works." : "Calendar link ready.");
    });
  }

  async function handleReset() {
    const ok = await confirm({
      title: "Create a new calendar link?",
      body: "The current link stops working immediately. Anyone already subscribed — including you, on every device — has to subscribe again with the new one.",
      confirmLabel: "Create new link",
    });
    if (ok) generate(true);
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some mobile browsers and over plain
      // HTTP. The input below is selectable, so this is recoverable.
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <Card>
      {dialog}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="size-4 text-muted-foreground" aria-hidden="true" />
          Add to your calendar
        </CardTitle>
        <CardDescription>
          Subscribe once and every fixture, training session and time change
          appears in your own calendar app automatically. It keeps working
          without signal.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!token ? (
          <Button onClick={() => generate(false)} disabled={pending}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            {pending ? "Creating…" : "Create my calendar link"}
          </Button>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                readOnly
                value={feedUrl ?? ""}
                aria-label="Your calendar subscription link"
                onFocus={(e) => e.currentTarget.select()}
                className="flex h-10 w-full rounded-md border border-input bg-muted px-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button variant="outline" onClick={copy} className="shrink-0" disabled={!feedUrl}>
                {copied ? (
                  <Check className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">How to add it</p>
              <p>
                <span className="font-medium">iPhone:</span> Calendar → Calendars →
                Add Calendar → Add Subscription Calendar, then paste.
              </p>
              <p>
                <span className="font-medium">Google Calendar:</span> on a computer,
                Other calendars → + → From URL, then paste.
              </p>
              <p>
                <span className="font-medium">Outlook:</span> Add calendar →
                Subscribe from web, then paste.
              </p>
              <p className="pt-1">
                Paste it as a <em>subscription</em>, not a download — a downloaded
                file is a snapshot and won&apos;t update when something changes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={pending}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Reset link
              </Button>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can see your schedule. Reset it if you&apos;ve
                shared it too widely.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

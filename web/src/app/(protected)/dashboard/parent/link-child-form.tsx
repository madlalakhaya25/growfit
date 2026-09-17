"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { linkChild } from "@/app/actions/parent";
import {
  PARENT_LINK_CODE_LENGTH,
  formatParentLinkCode,
  isCompleteParentLinkCode,
  looksLikeAccessCode,
  normalizeParentLinkCode,
} from "@/lib/parent-link";

const RELATIONSHIPS = ["Parent", "Guardian", "Grandparent", "Sibling", "Other"];

/**
 * One input, one kind of code.
 *
 * This form used to offer three ways to find a child — share code, SA ID
 * number, MySAFA number — any of which linked an adult to a child with no
 * further check. Those are all things a stranger can come by; the share code
 * is the public passport URL. See migration 032.
 */
export function LinkChildForm() {
  const [code, setCode] = useState("");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) =>
      (await linkChild(formData)) ?? null,
    null
  );

  const normalized = normalizeParentLinkCode(code);
  const complete = isCompleteParentLinkCode(code);
  // Tell someone who pasted a club code what they actually have, before they
  // submit and before the server has to guess.
  const clubCodeHint = looksLikeAccessCode(code);

  return (
    <form action={formAction} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          Child link code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. 7F3A2-9C1B4"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          aria-describedby="code-hint"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-mono uppercase placeholder:text-muted-foreground placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id="code-hint" className="text-xs text-muted-foreground">
          {clubCodeHint ? (
            <span className="text-amber-600">
              That looks like a club or team code. A child link code is{" "}
              {PARENT_LINK_CODE_LENGTH} characters — ask your child&apos;s coach for one.
            </span>
          ) : normalized && !complete ? (
            <>
              {normalized.length} of {PARENT_LINK_CODE_LENGTH} characters.
            </>
          ) : complete ? (
            <>Reads as {formatParentLinkCode(code)}.</>
          ) : (
            <>
              Ask your child&apos;s coach for a link code. It works once and expires
              after 14 days.
            </>
          )}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="relationship" className="text-sm font-medium">Relationship</label>
        <select
          id="relationship"
          name="relationship"
          defaultValue="Parent"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !complete} size="sm">
        {pending ? "Linking…" : "Link child"}
      </Button>
    </form>
  );
}

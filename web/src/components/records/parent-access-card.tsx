"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ShieldCheck, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  issueParentLinkCode,
  revokeParentLinkCode,
  unlinkParent,
} from "@/app/actions/parent";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatParentLinkCode, type ParentLinkCodeSummary } from "@/lib/parent-link";
import { formatDayMonthYear } from "@/lib/time";

export interface LinkedAdult {
  parent_id: string;
  full_name: string | null;
  relationship: string | null;
  linked_at: string;
  verification_method: string | null;
}

const RELATIONSHIPS = ["Parent", "Guardian", "Grandparent", "Sibling", "Other"];

const METHOD_LABEL: Record<string, string> = {
  parent_link_code: "Link code",
  staff_added: "Added by staff",
  grandfathered: "Pre-dates verification",
};

function formatDate(value: string) {
  return formatDayMonthYear(value);
}

/**
 * Who can see this child's records, and how they proved they should.
 *
 * A parent used to link themselves using the child's public share token — the
 * passport URL, also printed on the PDF card — which granted read and write
 * access to the child's medical record. Now a coach or admin issues a
 * single-use code for a specific child, so the verification is a human who
 * knows the family and the code merely carries it. See migration 032.
 */
export function ParentAccessCard({
  playerId,
  playerName,
  linkedAdults,
  codes,
  loadError,
}: {
  playerId: string;
  playerName: string;
  linkedAdults: LinkedAdult[];
  codes: ParentLinkCodeSummary[];
  loadError?: string;
}) {
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [issued, setIssued] = useState<{ code: string; expiresAt?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const { confirm, dialog } = useConfirm();

  const liveCodes = codes.filter((c) => c.status === "live");

  function issue() {
    setError(null);
    setIssued(null);
    start(async () => {
      const res = await issueParentLinkCode(playerId, relationship);
      if (res.error || !res.code) {
        setError(res.error ?? "Could not create a code.");
        return;
      }
      setIssued({ code: res.code, expiresAt: res.expiresAt });
    });
  }

  function copy() {
    if (!issued) return;
    void navigator.clipboard.writeText(formatParentLinkCode(issued.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke(codeId: string) {
    setError(null);
    start(async () => {
      const res = await revokeParentLinkCode(codeId, playerId);
      if (res.error) setError(res.error);
    });
  }

  async function unlink(parentId: string, name: string | null) {
    const ok = await confirm({
      title: `Remove ${name ?? "this adult"}'s access?`,
      body: `They will no longer see ${playerName}'s records, ratings, fixtures or medical information. They would need a new staff-issued code to be linked again.`,
      confirmLabel: "Remove access",
    });
    if (!ok) return;
    setError(null);
    start(async () => {
      const res = await unlinkParent(parentId, playerId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <Card>
      {dialog}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          Parent &amp; guardian access
        </CardTitle>
        <CardDescription>
          Adults who can see {playerName}&apos;s records, including medical and
          emergency information. Only add people you know are family.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {loadError && <p className="text-xs text-amber-600">{loadError}</p>}

        {/* Linked adults */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Linked adults
          </p>
          {linkedAdults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is linked yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {linkedAdults.map((adult) => (
                <li key={adult.parent_id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{adult.full_name ?? "Unnamed account"}</p>
                    <p className="text-xs text-muted-foreground">
                      {adult.relationship ?? "Parent"} · linked {formatDate(adult.linked_at)}
                      {adult.verification_method && (
                        <> · {METHOD_LABEL[adult.verification_method] ?? adult.verification_method}</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlink(adult.parent_id, adult.full_name)}
                    disabled={isPending}
                    aria-label={`Remove ${adult.full_name ?? "this adult"}'s access`}
                    className="shrink-0 rounded border border-border bg-background p-1.5 hover:bg-muted disabled:opacity-50"
                  >
                    <UserMinus className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Issue */}
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Create a link code
          </p>

          {issued ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <p className="font-mono text-lg font-bold tracking-widest">
                  {formatParentLinkCode(issued.code)}
                </p>
                <button
                  type="button"
                  onClick={copy}
                  aria-label="Copy link code"
                  className="rounded border border-border bg-background p-1 hover:bg-muted"
                >
                  {copied
                    ? <Check className="size-3 text-primary" aria-hidden="true" />
                    : <Copy className="size-3" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIssued(null)}
                  aria-label="Hide code"
                  className="ml-auto rounded border border-border bg-background p-1 hover:bg-muted"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Give this to the parent in person or by direct message.{" "}
                <strong>Do not post it in a group.</strong> It works once
                {issued.expiresAt && <> and expires {formatDate(issued.expiresAt)}</>}.
                You will not be able to see it again — create another if it is lost.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <label htmlFor="new-code-relationship" className="text-xs text-muted-foreground">
                  Relationship
                </label>
                <select
                  id="new-code-relationship"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Button type="button" size="sm" onClick={issue} disabled={isPending}>
                {isPending ? "Creating…" : "Create parent link code"}
              </Button>
            </div>
          )}
        </div>

        {/* Outstanding codes */}
        {liveCodes.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Unused codes
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {liveCodes.map((code) => (
                <li key={code.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">····{code.code_last4}</p>
                    <p className="text-xs text-muted-foreground">
                      {code.relationship ?? "Parent"}
                      {code.issued_by_name && <> · issued by {code.issued_by_name}</>}
                      {" · expires "}{formatDate(code.expires_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(code.id)}
                    disabled={isPending}
                    aria-label={`Revoke code ending ${code.code_last4}`}
                    className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

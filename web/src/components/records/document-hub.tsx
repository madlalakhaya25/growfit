"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signDocumentDigitally, signConsentDocument, uploadDocumentScan } from "@/app/actions/records";
import { DOCUMENTS } from "@/lib/document-definitions";
import type { DocDef } from "@/lib/document-definitions";
import { formatDayMonthYear } from "@/lib/time";


type DocumentRecord = {
  document_type: string;
  status: string;
  signer_name?: string | null;
  signed_at?: string | null;
  uploaded_at?: string | null;
  upload_url?: string | null;
};

type Props = {
  playerId: string;
  season: string;
  documents: DocumentRecord[];
  readOnly?: boolean;
};

function StatusBadge({ doc }: { doc: DocumentRecord | undefined }) {
  if (!doc || doc.status === "unsigned") {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        Unsigned
      </span>
    );
  }
  if (doc.status === "signed") {
    const date = doc.signed_at ? formatDayMonthYear(doc.signed_at) : "";
    return (
      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-700">
        Signed digitally{date ? ` · ${date}` : ""}{doc.signer_name ? ` · ${doc.signer_name}` : ""}
      </span>
    );
  }
  if (doc.status === "uploaded") {
    const date = doc.uploaded_at ? formatDayMonthYear(doc.uploaded_at) : "";
    return (
      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
        {doc.upload_url ? (
          <a href={doc.upload_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            View upload
          </a>
        ) : "Uploaded"}{date ? ` · ${date}` : ""}
      </span>
    );
  }
  if (doc.status === "needs_renewal") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
        Needs renewal
      </span>
    );
  }
  return null;
}

function SigningModal({
  def,
  playerId,
  season,
  onClose,
  onSigned,
}: {
  def: DocDef;
  playerId: string;
  season: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [signerName, setSignerName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [checkboxValues, setCheckboxValues] = useState<Record<string, boolean>>({});
  const [signError, setSignError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allCheckboxesTicked =
    !def.checkboxes || def.checkboxes.every((cb) => checkboxValues[cb.id]);

  const canSign = signerName.trim().length > 0 && agreed && allCheckboxesTicked;

  function handleSign() {
    if (!canSign) return;
    setSignError(null);
    startTransition(async () => {
      let result: { error?: string } | undefined;
      if (def.type === "consent_form") {
        result = await signConsentDocument(playerId, season, signerName.trim(), {
          participation_consent: !!checkboxValues["participation_consent"],
          photo_consent: !!checkboxValues["photo_consent"],
          transport_consent: !!checkboxValues["transport_consent"],
          risk_acknowledged: !!checkboxValues["risk_acknowledged"],
        });
      } else {
        result = await signDocumentDigitally(playerId, def.type, season, signerName.trim(), def.signerRole);
      }
      if (result?.error) {
        setSignError(result.error);
        toast.error(result.error);
      } else {
        toast.success(`${def.label} signed.`);
        onSigned();
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Sign ${def.label}`}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* modal panel */}
      <div className="relative z-10 flex flex-col w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl bg-card shadow-2xl max-h-[92dvh] sm:max-h-[88vh] overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="font-semibold text-base leading-tight">{def.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{def.form} · {season} season</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* consent checkboxes (CON-02) */}
          {def.checkboxes && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                Read each statement carefully and tick to confirm your consent.
              </p>
              {def.checkboxes.map((cb) => (
                <label
                  key={cb.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checkboxValues[cb.id]
                      ? "border-green-500/40 bg-green-500/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checkboxValues[cb.id]}
                    onChange={(e) =>
                      setCheckboxValues((prev) => ({ ...prev, [cb.id]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-green-600"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{cb.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cb.hint}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* document terms */}
          {def.terms && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {def.checkboxes ? "Additional terms" : "Document terms"}
              </p>
              <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                {def.terms}
              </p>
            </div>
          )}
        </div>

        {/* sticky footer */}
        <div className="shrink-0 border-t border-border px-5 py-4 space-y-3 bg-card">
          <div className="space-y-1.5">
            <label htmlFor={`modal-signer-${def.type}`} className="text-sm font-medium">
              Full name <span className="text-muted-foreground font-normal">(typed signature)</span>
            </label>
            <input
              id={`modal-signer-${def.type}`}
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Thabo Dlamini"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-green-600"
            />
            <span className="text-sm">
              I have read this document in full and agree to be bound by its terms.
            </span>
          </label>

          {signError && (
            <p className="text-sm text-destructive">{signError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !canSign}
              onClick={handleSign}
              className="inline-flex h-10 flex-[2] items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-opacity"
            >
              {isPending ? "Signing…" : "Sign document"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  def,
  record,
  playerId,
  season,
  readOnly,
}: {
  def: DocDef;
  record: DocumentRecord | undefined;
  playerId: string;
  season: string;
  readOnly?: boolean;
}) {
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, startUploadTransition] = useTransition();

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setUploadError(null);
    setUploadSuccess(false);
    startUploadTransition(async () => {
      const result = await uploadDocumentScan(formData);
      if (result?.error) {
        setUploadError(result.error);
        toast.error(result.error);
      } else {
        setUploadSuccess(true);
        toast.success("Uploaded successfully.");
        setUploadOpen(false);
        form.reset();
      }
    });
  }

  const isSigned = record?.status === "signed" || record?.status === "uploaded";

  return (
    <>
      {signModalOpen && !def.uploadOnly && (
        <SigningModal
          def={def}
          playerId={playerId}
          season={season}
          onClose={() => setSignModalOpen(false)}
          onSigned={() => setSignModalOpen(false)}
        />
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isSigned && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-green-600 shrink-0" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              )}
              <p className="font-medium text-sm truncate">{def.label}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{def.form}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge doc={record} />
              {!def.uploadOnly && (
                <a
                  href={`/print/document/${playerId}/${def.type}?season=${season}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Download PDF
                </a>
              )}
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              {!def.uploadOnly && (
                <button
                  type="button"
                  onClick={() => setSignModalOpen(true)}
                  className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  {isSigned ? "View / re-sign" : "Sign here"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setUploadOpen((v) => !v)}
                className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                {def.uploadOnly ? "Upload scan" : "Upload PDF"}
              </button>
            </div>
          )}
        </div>

        {!readOnly && uploadOpen && (
          <div className="border-t border-border p-4 space-y-3 bg-muted/30">
            {def.type === "id_document" && (
              <p className="text-sm text-muted-foreground">
                Upload a clear scan or photo of the player&apos;s birth certificate or South African ID document. Accepted formats: PDF, JPEG, PNG.
              </p>
            )}
            <form onSubmit={handleUpload} encType="multipart/form-data" className="space-y-3">
              <input type="hidden" name="player_id" value={playerId} />
              <input type="hidden" name="document_type" value={def.type} />
              <input type="hidden" name="season" value={season} />

              <div className="space-y-1.5">
                <label htmlFor={`file-${def.type}`} className="text-sm font-medium">
                  {def.uploadOnly ? "Select file" : "Select PDF file"}
                </label>
                <input
                  id={`file-${def.type}`}
                  type="file"
                  name="file"
                  accept={def.accept ?? ".pdf,application/pdf"}
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
              </div>

              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              {uploadSuccess && <p className="text-sm text-green-600">Uploaded successfully.</p>}

              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isUploading ? "Uploading…" : "Upload"}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

export function DocumentHub({ playerId, season, documents, readOnly }: Props) {
  const docMap = new Map(documents.map((d) => [d.document_type, d]));

  const signableDocs = DOCUMENTS.filter((d) => !d.uploadOnly);
  const signedCount = signableDocs.filter((d) => {
    const rec = docMap.get(d.type);
    return rec?.status === "signed";
  }).length;
  const uploadOnlyDocs = DOCUMENTS.filter((d) => d.uploadOnly);
  const uploadedCount = uploadOnlyDocs.filter((d) => {
    const rec = docMap.get(d.type);
    return rec?.status === "uploaded";
  }).length;
  const totalComplete = signedCount + uploadedCount;
  const total = DOCUMENTS.length;
  const allDone = totalComplete === total;

  return (
    <div className="space-y-4">
      {/* progress summary */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {allDone ? "All documents complete" : `${totalComplete} of ${total} documents complete`}
          </span>
          <span className={`text-xs font-semibold ${allDone ? "text-green-600" : "text-muted-foreground"}`}>
            {Math.round((totalComplete / total) * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${(totalComplete / total) * 100}%` }}
          />
        </div>
        {!allDone && (
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? `${total - totalComplete} document${total - totalComplete !== 1 ? "s" : ""} still awaiting parent signature or upload.`
              : `Sign or upload the remaining documents to complete your registration for the ${season} season.`}
          </p>
        )}
      </div>

      {DOCUMENTS.map((def) => (
        <DocumentRow
          key={def.type}
          def={def}
          record={docMap.get(def.type)}
          playerId={playerId}
          season={season}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wand2, Plus, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSessionPlan } from "@/app/actions/session-generator";
import { createTrainingSessionWithDrills } from "@/app/actions/training";

const SESSION_TYPES = [
  { value: "general", label: "General" },
  { value: "technical", label: "Technical" },
  { value: "tactical", label: "Tactical" },
  { value: "fitness", label: "Fitness" },
  { value: "match_prep", label: "Match Prep" },
  { value: "recovery", label: "Recovery" },
];

const FOCUS_OPTIONS = [
  "Passing & Possession",
  "Defending",
  "Attacking Play",
  "Set Pieces",
  "Fitness & Conditioning",
  "Goalkeeping",
  "1v1 Duels",
  "Pressing",
  "Transition",
];

interface DrillItem {
  id: string;
  title: string;
  description: string;
  video_url: string;
}

function parseAIDrills(text: string): DrillItem[] {
  const drills: DrillItem[] = [];
  const lines = text.split("\n");
  let currentTitle = "";
  let descLines: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    drills.push({
      id: crypto.randomUUID(),
      title: currentTitle,
      description: descLines.filter(Boolean).join("\n"),
      video_url: "",
    });
    currentTitle = "";
    descLines = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^DRILL\s+\d+:\s*(.+)/i);
    if (match) {
      flush();
      currentTitle = match[1].trim();
    } else if (currentTitle && line) {
      descLines.push(line);
    }
  }
  flush();
  return drills;
}

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const selectCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewSessionForm({
  teamId,
  teams,
  backHref,
}: {
  teamId: string;
  teams: { id: string; name: string; age_group: string | null }[];
  backHref: string;
}) {
  const router = useRouter();

  // Session fields
  const [selectedTeamId, setSelectedTeamId] = useState(teamId);
  const [title, setTitle] = useState("");
  const defaultDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16);
  const [sessionDate, setSessionDate] = useState(defaultDate);
  const [location, setLocation] = useState("");
  const [sessionType, setSessionType] = useState("general");
  const [notes, setNotes] = useState("");

  // Drills
  const [drills, setDrills] = useState<DrillItem[]>([]);

  // AI generator
  const [showAI, setShowAI] = useState(false);
  const [ageGroup, setAgeGroup] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [duration, setDuration] = useState(90);
  const [squadSize, setSquadSize] = useState(16);
  const [aiSuggestions, setAiSuggestions] = useState<DrillItem[]>([]);
  const [aiError, setAiError] = useState("");
  const [isGenerating, startGenerate] = useTransition();

  // Manual add
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  // Submit
  const [submitError, setSubmitError] = useState("");
  const [isPending, startSubmit] = useTransition();

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  const handleGenerate = () => {
    const ag = ageGroup.trim() || selectedTeam?.age_group || "";
    if (!ag || !focusArea) {
      setAiError("Please enter age group and select a focus area.");
      return;
    }
    setAiError("");
    setAiSuggestions([]);
    startGenerate(async () => {
      const result = await generateSessionPlan({
        ageGroup: ag,
        sessionType,
        focusArea,
        durationMinutes: duration,
        squadSize,
      });
      if (result.error) {
        setAiError(result.error);
      } else if (result.plan) {
        const parsed = parseAIDrills(result.plan);
        if (parsed.length === 0) {
          setAiError("Could not parse drills from AI response. Try again.");
        } else {
          setAiSuggestions(parsed);
        }
      }
    });
  };

  const addSuggestion = (drill: DrillItem) => {
    setDrills((prev) => [...prev, { ...drill, id: crypto.randomUUID() }]);
    setAiSuggestions((prev) => prev.filter((d) => d.id !== drill.id));
  };

  const addAllSuggestions = () => {
    setDrills((prev) => [
      ...prev,
      ...aiSuggestions.map((d) => ({ ...d, id: crypto.randomUUID() })),
    ]);
    setAiSuggestions([]);
  };

  const removeDrill = (id: string) => setDrills((prev) => prev.filter((d) => d.id !== id));

  const handleAddManual = () => {
    if (!manualTitle.trim()) return;
    setDrills((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: manualTitle.trim(),
        description: manualDesc.trim(),
        video_url: "",
      },
    ]);
    setManualTitle("");
    setManualDesc("");
    setShowManual(false);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setSubmitError("Session title is required.");
      return;
    }
    if (!sessionDate) {
      setSubmitError("Date is required.");
      return;
    }
    setSubmitError("");
    startSubmit(async () => {
      const result = await createTrainingSessionWithDrills({
        team_id: selectedTeamId,
        title: title.trim(),
        session_date: sessionDate,
        location: location || undefined,
        session_type: sessionType,
        notes: notes || undefined,
        drills: drills.map(({ title, description, video_url }) => ({
          title,
          description: description || undefined,
          video_url: video_url || undefined,
        })),
      });
      if (result.error) {
        setSubmitError(result.error);
      } else if (result.id) {
        router.push(`/dashboard/coach/training/${result.id}`);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Session details card */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Session details</h2>

        {teams.length > 1 && (
          <div className="space-y-1.5">
            <label htmlFor="ns-team_id" className="text-sm font-medium">Team *</label>
            <select
              id="ns-team_id"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className={selectCls}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.age_group ? ` · ${t.age_group}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pre-match activation"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date & time *</label>
            <input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ns-session_type" className="text-sm font-medium">Session type *</label>
            <select
              id="ns-session_type"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className={selectCls}
            >
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Main pitch, Field 3"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Optional notes for the squad…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </section>

      {/* Drills card */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Drills</h2>
          {drills.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
              {drills.length}
            </span>
          )}
        </div>

        {/* AI generator collapsible */}
        <div className="rounded-lg border border-dashed">
          <button
            type="button"
            onClick={() => setShowAI((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
          >
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Generate drills with AI
            </span>
            {showAI ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showAI && (
            <div className="px-4 pb-4 space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Age Group
                  </label>
                  <input
                    type="text"
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    placeholder={selectedTeam?.age_group ?? "e.g. U14"}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Focus Area
                  </label>
                  <select
                    aria-label="Focus area"
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select…</option>
                    {FOCUS_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Duration
                  </label>
                  <select
                    aria-label="Duration"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className={selectCls}
                  >
                    {[60, 75, 90, 120].map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Squad Size
                  </label>
                  <input
                    type="number"
                    value={squadSize}
                    onChange={(e) => setSquadSize(Number(e.target.value))}
                    min={4}
                    max={40}
                    className={inputCls}
                  />
                </div>
              </div>

              {aiError && (
                <p className="text-sm text-destructive">{aiError}</p>
              )}

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                size="sm"
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate 5 drills
                  </>
                )}
              </Button>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      AI suggestions
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllSuggestions}
                      className="h-7 text-xs px-3"
                    >
                      Add all {aiSuggestions.length}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {aiSuggestions.map((drill) => (
                      <div
                        key={drill.id}
                        className="rounded-lg border bg-muted/30 p-3 flex gap-3 items-start"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">{drill.title}</p>
                          {drill.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {drill.description.split("\n")[0]}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addSuggestion(drill)}
                          className="h-8 px-3 shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Added drills list */}
        {drills.length > 0 && (
          <div className="space-y-2">
            {drills.map((drill, idx) => (
              <div
                key={drill.id}
                className="rounded-lg border bg-background p-3 flex gap-3 items-start"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{drill.title}</p>
                  {drill.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {drill.description.split("\n")[0]}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeDrill(drill.id)}
                  className="mt-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove drill"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual add */}
        {showManual ? (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Add drill manually</p>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="Drill title *"
              className={inputCls}
            />
            <textarea
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              rows={2}
              placeholder="Description (optional)"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleAddManual}
                disabled={!manualTitle.trim()}
              >
                Add drill
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowManual(false);
                  setManualTitle("");
                  setManualDesc("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowManual(true)}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add drill manually
          </Button>
        )}

        {drills.length === 0 && !showManual && (
          <p className="text-sm text-muted-foreground text-center py-1">
            No drills yet — generate with AI or add manually.
          </p>
        )}
      </section>

      {/* Actions */}
      {submitError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {submitError}
        </p>
      )}

      <div className="flex gap-3 pb-6">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating…
            </>
          ) : (
            "Create session"
          )}
        </Button>
        <Button asChild variant="outline">
          <Link href={backHref}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

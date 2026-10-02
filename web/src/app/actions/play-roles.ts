"use server";

import { revalidatePath } from "next/cache";
import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { PLAYER_FACING_RULE, specialistSystem } from "@/lib/ai-safeguards";
import { generateWithRetry } from "@/lib/ai-resilient";
import {
  fingerprintBrief, getLatestAiArtefact, isCacheHit, readUsage, saveAiArtefact,
} from "@/lib/ai-artefacts";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { reportError } from "@/lib/report-error";
import { getConcept } from "@/lib/tactics";
import {
  buildPlayRolesBrief, collectRolePlayers, playRolesHash, roleForPlayer, validatePlayRoles,
  type PlayRolesData, type RosterPlayer,
} from "@/lib/play-roles";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface PlayRoleView { playerId: string; name: string; text: string }
export interface PlayRolesResult {
  roles?: PlayRoleView[];
  status?: "draft" | "approved";
  artefactId?: string;
  cached?: boolean;
  /** False when generated but not saved (migration 049 pending). */
  persisted?: boolean;
  error?: string;
}

/**
 * Coach: write each named player's "my job in this play" for a SAVED play.
 *
 * Shown to players only after the coach approves it (approvePlayRoles) -- it is
 * player-facing text, so it is a draft until a coach has read it. Reads the
 * play as saved, not as it sits on the open board. A cached draft or approved
 * set is served free when the play and the players' ages are unchanged.
 */
export async function generatePlayRoles(params: { playId: string; force?: boolean }): Promise<PlayRolesResult> {
  try {
    const { supabase, user } = await requireUser();

    const { data: play } = await supabase
      .from("tactic_plays")
      .select("id, academy_id, team_id, name, data, concept_ids, surface")
      .eq("id", params.playId)
      .single();
    // Not redundant with RLS, which is academy-wide: only this team's coach.
    if (!play || !(await getCoachedTeamIds(supabase, user.id)).includes(play.team_id as string)) {
      return { error: "You don't coach this team." };
    }
    if (play.surface === "film") return { error: "Player jobs are for tactical-board plays, not film." };

    const { data: members } = await supabase
      .from("team_members")
      .select("players(id, full_name, date_of_birth, position)")
      .eq("team_id", play.team_id)
      .eq("active", true);
    const roster: RosterPlayer[] = ((members ?? []) as unknown as { players: RosterPlayer | RosterPlayer[] | null }[])
      .flatMap((m) => {
        if (Array.isArray(m.players)) return m.players;
        return m.players ? [m.players] : [];
      });

    const players = collectRolePlayers(play.data, roster);
    if (players.length === 0) {
      return { error: "Draw a run or a pass for at least one of your named players first, then save the play." };
    }

    const conceptIds = (play.concept_ids as string[] | null) ?? [];
    const name = play.name as string;
    const brief = buildPlayRolesBrief({ name, conceptLabels: conceptIds.map((id) => getConcept(id)?.label ?? id) }, players);
    const fingerprint = fingerprintBrief(brief);
    const names = new Map(players.map((p) => [p.playerId, p.name]));
    const view = (d: PlayRolesData): PlayRoleView[] =>
      d.roles.filter((r) => names.has(r.playerId)).map((r) => ({ playerId: r.playerId, name: names.get(r.playerId)!, text: r.text }));

    const { artefact } = await getLatestAiArtefact<PlayRolesData>(supabase, {
      kind: "play_roles", subjectType: "play", subjectId: params.playId,
    });
    if (!params.force && artefact && isCacheHit(artefact, { modelId: AI_MODEL, inputsFingerprint: fingerprint })) {
      return { roles: view(artefact.data), status: artefact.status, artefactId: artefact.id, cached: true, persisted: true };
    }

    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const response = await generateWithRetry(ai, {
      model: AI_MODEL,
      contents: `A youth football coach has drawn a play. For EACH player below, write what THEY do in the play, to be read by that player.

${brief}

Write 2 to 4 short sentences per player, speaking to them as "you", using only the jobs listed for them. Use their first name once at most. Match the reading level and length to their age: simple words and very short sentences for the youngest, a little more tactical detail for the oldest. Say where to go and why it helps the team. Return one entry per player, using the id exactly as given.`,
      config: {
        maxOutputTokens: 1800,
        // Direct-answer task: thinking tokens would eat the visible-output
        // budget and truncate the JSON with no error.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `${specialistSystem({ focus: "tactics for young players", plainText: "in every field" })} ${PLAYER_FACING_RULE}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            roles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { playerId: { type: Type.STRING }, text: { type: Type.STRING } },
                required: ["playerId", "text"],
              },
            },
          },
          required: ["roles"],
        },
      },
    });

    const roles = validatePlayRoles(parseJsonObject(response.text ?? ""), players.map((p) => p.playerId));
    if (roles.length === 0) return { error: "Could not read the AI's player jobs. Try again." };

    const data: PlayRolesData = {
      roles, playHash: playRolesHash({ name, conceptIds }, players), playerIds: players.map((p) => p.playerId),
    };
    const saved = await saveAiArtefact<PlayRolesData>(supabase, {
      kind: "play_roles", subjectType: "play", subjectId: params.playId,
      academyId: play.academy_id as string, createdBy: user.id, data, modelId: AI_MODEL,
      inputsFingerprint: fingerprint, tokens: readUsage(response), status: "draft",
    });
    if (saved.error) reportError(saved.error, { scope: "generatePlayRoles", severity: "warning" });

    return { roles: view(data), status: "draft", artefactId: saved.artefact?.id, cached: false, persisted: saved.persisted };
  } catch (err) {
    return { error: aiError(err) };
  }
}

/** Coach: release a draft to the players who are in the play. */
export async function approvePlayRoles(artefactId: string): Promise<{ success?: true; error?: string }> {
  try {
    const { supabase, user } = await requireUser();

    const { data: art } = await supabase
      .from("ai_artefacts")
      .select("id, kind, subject_type, subject_id, status, superseded_at")
      .eq("id", artefactId)
      .single();
    if (art?.kind !== "play_roles" || art.subject_type !== "play" || art.superseded_at) {
      return { error: "That set of player jobs is out of date. Generate it again." };
    }
    const { data: play } = await supabase.from("tactic_plays").select("team_id").eq("id", art.subject_id).single();
    if (!play || !(await getCoachedTeamIds(supabase, user.id)).includes(play.team_id as string)) {
      return { error: "You don't coach this team." };
    }

    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const { error } = await supabase
      .from("ai_artefacts")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_by_name: (me?.full_name as string | undefined) ?? "A coach",
        approved_at: new Date().toISOString(),
      })
      .eq("id", artefactId);
    if (error) return { error: "Couldn't approve that. Try again." };

    revalidatePath("/dashboard/player/tactics", "layout");
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "approvePlayRoles" });
    return { error: "Couldn't approve that. Try again." };
  }
}

/**
 * Player: my own approved job in a play they were shown by share token, or
 * null. Null for anything that isn't certainly fine to show: no approved set,
 * the play changed since approval, or the viewer isn't a player in it. RLS
 * (migration 049) already limits the read to approved sets for shared plays on
 * the viewer's own team; the hash check is the other half.
 */
export async function getMyPlayRole(token: string): Promise<{ text: string | null }> {
  try {
    const { supabase, user } = await requireUser();

    const { data: play } = await supabase
      .from("tactic_plays")
      .select("id, name, data, concept_ids, team_id")
      .eq("share_token", token.trim().toLowerCase())
      .eq("shared", true)
      .single();
    if (!play) return { text: null };

    const { data: me } = await supabase.from("players").select("id, full_name, date_of_birth, position").eq("profile_id", user.id).single();
    if (!me) return { text: null };

    const { artefact } = await getLatestAiArtefact<PlayRolesData>(supabase, {
      kind: "play_roles", subjectType: "play", subjectId: play.id as string, status: "approved",
    });
    if (!artefact) return { text: null };

    // Recompute from the play as it is now, over the same players the set was
    // generated for. Ages don't matter here, only the drawn jobs, so a roster
    // of ids with a placeholder name is enough, and the viewer's own name is
    // never needed. A set written before the ids were stored falls back to
    // every named token on the board.
    const conceptIds = (play.concept_ids as string[] | null) ?? [];
    const tokenIds = ((play.data as { tokens?: { playerId?: string }[] } | null)?.tokens ?? [])
      .map((t) => t.playerId).filter((id): id is string => !!id);
    const ids = Array.isArray(artefact.data?.playerIds) ? artefact.data.playerIds : tokenIds;
    const roster = ids.map((id) => ({ id, full_name: id === me.id ? (me.full_name as string) : "Player", date_of_birth: null, position: null }));
    const current = playRolesHash({ name: play.name as string, conceptIds }, collectRolePlayers(play.data, roster));
    if (artefact.data?.playHash !== current) return { text: null };

    return { text: roleForPlayer(artefact.data, me.id as string) };
  } catch (err) {
    reportError(err, { scope: "getMyPlayRole", severity: "warning" });
    return { text: null };
  }
}

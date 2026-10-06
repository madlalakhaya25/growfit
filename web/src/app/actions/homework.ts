"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";
import { todayIso } from "@/lib/time";
import { getSharedPlay } from "@/app/actions/tactic-plays";
import { isMissingFunction } from "@/lib/shared-plays";
import {
  feedbackFor, forPlayer, isMissingHomeworkTable, resultMessage, scoreAnswers, summariseHomework,
  validateAnswers, validateDueDate, validateQuestions, validateTitle,
  type HomeworkQuestion, type HomeworkQuestionForPlayer, type HomeworkSummary, type QuestionFeedback,
  type ResponseRow, type RosterPlayer,
} from "@/lib/homework";

/**
 * Tactics homework (migration 063). A coach sends a saved play with 1 to 3
 * questions; a player watches the play and answers at home.
 *
 * Coach actions check the coach coaches the play's team here as well as in
 * RLS (the same belt-and-braces as tactic-plays.ts). Player actions start
 * from the signed-in player's own row and active teams, never from an id the
 * client sends for "who am I". Before 063 runs every read returns
 * `available: false` and every write a plain "needs database update" error.
 */

export interface CoachHomework {
  id: string;
  title: string;
  teamId: string;
  teamName: string;
  dueDate: string;
  questions: HomeworkQuestion[];
  hasPlay: boolean;
  summary: HomeworkSummary;
}

export interface MyHomeworkItem {
  id: string;
  title: string;
  teamName: string;
  dueDate: string;
  done: boolean;
  score: number | null;
  total: number | null;
}

export interface MyHomeworkDetail {
  id: string;
  title: string;
  dueDate: string;
  play: { name: string; notes: string | null; data: unknown } | null;
  /** Before answering: the questions without the answer key. */
  questions: HomeworkQuestionForPlayer[];
  /** After answering: what they chose, the right answer and why. */
  result: { score: number; total: number; message: string; feedback: QuestionFeedback[] } | null;
}

type AssignmentRow = {
  id: string; team_id: string; play_id: string | null; title: string;
  questions: HomeworkQuestion[]; due_date: string;
  teams?: { name: string } | { name: string }[] | null;
};

const teamNameOf = (t: AssignmentRow["teams"]) => (Array.isArray(t) ? t[0]?.name : t?.name) ?? "";

/** The signed-in player's own row and their active team ids. */
async function myPlayer() {
  const { supabase, user } = await requireUser();
  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!player) return { supabase, playerId: null, teamIds: [] as string[] };
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("player_id", player.id)
    .eq("active", true);
  const teamIds = ((memberships ?? []) as { team_id: string }[]).map((m) => m.team_id);
  return { supabase, playerId: player.id as string, teamIds };
}

// ── Coach ────────────────────────────────────────────────────────────────

export async function sendHomework(input: {
  playId: string;
  title: string;
  dueDate: string;
  questions: unknown;
}): Promise<{ id?: string; error?: string }> {
  const t = validateTitle(input.title);
  if (!t.title) return { error: t.error };
  const d = validateDueDate(input.dueDate, todayIso());
  if (!d.dueDate) return { error: d.error };
  const q = validateQuestions(input.questions);
  if (!q.questions) return { error: q.error };

  const { supabase, user } = await requireUser();
  const teamIds = await getCoachedTeamIds(supabase, user.id);
  const { data: play } = await supabase
    .from("tactic_plays")
    .select("id, team_id, academy_id")
    .eq("id", input.playId)
    .in("team_id", teamIds)
    .maybeSingle();
  if (!play) return { error: "Play not found, or you don't coach its team." };

  const { data, error } = await supabase
    .from("homework_assignments")
    .insert({
      academy_id: play.academy_id,
      team_id: play.team_id,
      play_id: play.id,
      title: t.title,
      questions: q.questions,
      due_date: d.dueDate,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (isMissingHomeworkTable(error)) return { error: "Homework needs database update 063. Ask your admin to run it." };
  if (error || !data) return { error: friendlyError(error, "Couldn't send the homework.") };

  // Players can only open a play that is shared with their team (051).
  await supabase.from("tactic_plays").update({ shared: true }).eq("id", play.id).eq("team_id", play.team_id);

  revalidatePath("/dashboard/coach/tactics/homework");
  revalidatePath("/dashboard/player/homework");
  return { id: data.id as string };
}

export async function deleteHomework(id: string): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const teamIds = await getCoachedTeamIds(supabase, user.id);
  const { data: rows, error } = await supabase
    .from("homework_assignments")
    .delete()
    .eq("id", id)
    .in("team_id", teamIds)
    .select("id");
  if (isMissingHomeworkTable(error)) return { error: "Homework needs database update 063. Ask your admin to run it." };
  if (error) return { error: friendlyError(error) };
  if (!rows?.length) return { error: "Homework not found, or you don't coach its team." };
  revalidatePath("/dashboard/coach/tactics/homework");
  return { success: true };
}

/** Every homework on the caller's teams, with who has done it and how it went. */
export async function listCoachHomework(): Promise<{ available: boolean; items: CoachHomework[]; error?: string }> {
  const { supabase, user } = await requireUser();
  const teamIds = await getCoachedTeamIds(supabase, user.id);
  if (teamIds.length === 0) return { available: true, items: [] };

  const { data, error } = await supabase
    .from("homework_assignments")
    .select("id, team_id, play_id, title, questions, due_date, teams ( name )")
    .in("team_id", teamIds)
    .order("due_date", { ascending: false })
    .limit(30);
  if (isMissingHomeworkTable(error)) return { available: false, items: [] };
  if (error) return { available: true, items: [], error: friendlyError(error) };
  const assignments = (data ?? []) as AssignmentRow[];
  if (assignments.length === 0) return { available: true, items: [] };

  const [{ data: members }, { data: responses }] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id, players ( id, full_name, active )")
      .in("team_id", [...new Set(assignments.map((a) => a.team_id))])
      .eq("active", true),
    supabase
      .from("homework_responses")
      .select("assignment_id, player_id, answers, score, total, completed_at")
      .in("assignment_id", assignments.map((a) => a.id)),
  ]);

  type Member = { team_id: string; players: { id: string; full_name: string; active?: boolean } | { id: string; full_name: string; active?: boolean }[] | null };
  const rosters = new Map<string, RosterPlayer[]>();
  for (const m of (members ?? []) as Member[]) {
    const p = Array.isArray(m.players) ? m.players[0] : m.players;
    if (!p || p.active === false) continue;
    rosters.set(m.team_id, [...(rosters.get(m.team_id) ?? []), { id: p.id, name: p.full_name }]);
  }
  const allResponses = (responses ?? []) as (ResponseRow & { assignment_id: string })[];

  return {
    available: true,
    items: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      teamId: a.team_id,
      teamName: teamNameOf(a.teams),
      dueDate: a.due_date,
      questions: a.questions,
      hasPlay: a.play_id !== null,
      summary: summariseHomework(
        a.questions,
        rosters.get(a.team_id) ?? [],
        allResponses.filter((r) => r.assignment_id === a.id),
      ),
    })),
  };
}

// ── Player ───────────────────────────────────────────────────────────────

export async function listMyHomework(): Promise<{ available: boolean; items: MyHomeworkItem[]; error?: string }> {
  const { supabase, playerId, teamIds } = await myPlayer();
  if (!playerId || teamIds.length === 0) return { available: true, items: [] };

  const { data, error } = await supabase
    .from("homework_assignments")
    .select("id, team_id, play_id, title, questions, due_date, teams ( name )")
    .in("team_id", teamIds)
    .order("due_date", { ascending: false })
    .limit(30);
  if (isMissingHomeworkTable(error)) return { available: false, items: [] };
  if (error) return { available: true, items: [], error: friendlyError(error) };
  const rows = (data ?? []) as AssignmentRow[];

  const { data: mine } = await supabase
    .from("homework_responses")
    .select("assignment_id, score, total")
    .eq("player_id", playerId);
  const done = new Map(((mine ?? []) as { assignment_id: string; score: number; total: number }[]).map((r) => [r.assignment_id, r]));

  return {
    available: true,
    items: rows.map((a) => {
      const r = done.get(a.id);
      return {
        id: a.id, title: a.title, teamName: teamNameOf(a.teams), dueDate: a.due_date,
        done: Boolean(r), score: r?.score ?? null, total: r?.total ?? null,
      };
    }),
  };
}

async function loadPlayFor(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], playId: string | null) {
  if (!playId) return null;
  // Migration 070's function first; the direct read only until it has run.
  const viaFn = await supabase.rpc("shared_play_token", { p_play_id: playId });
  let token: string | undefined = viaFn.error ? undefined : ((viaFn.data as string | null) ?? undefined);
  if (viaFn.error && isMissingFunction(viaFn.error)) {
    const { data } = await supabase.from("tactic_plays").select("share_token").eq("id", playId).eq("shared", true).maybeSingle();
    token = (data as { share_token?: string } | null)?.share_token;
  }
  if (!token) return null;
  const { play } = await getSharedPlay(token);
  return play ? { name: play.name, notes: play.notes, data: play.data } : null;
}

export async function getMyHomework(id: string): Promise<{ available: boolean; homework?: MyHomeworkDetail; error?: string }> {
  const { supabase, playerId, teamIds } = await myPlayer();
  if (!playerId) return { available: true, error: "Your profile isn't linked to a player yet." };

  const { data, error } = await supabase
    .from("homework_assignments")
    .select("id, team_id, play_id, title, questions, due_date")
    .eq("id", id)
    .in("team_id", teamIds)
    .maybeSingle();
  if (isMissingHomeworkTable(error)) return { available: false };
  if (error) return { available: true, error: friendlyError(error) };
  if (!data) return { available: true, error: "This homework isn't for your team." };
  const a = data as AssignmentRow;

  const { data: response } = await supabase
    .from("homework_responses")
    .select("answers, score, total")
    .eq("assignment_id", a.id)
    .eq("player_id", playerId)
    .maybeSingle();
  const r = response as { answers: number[]; score: number; total: number } | null;

  return {
    available: true,
    homework: {
      id: a.id,
      title: a.title,
      dueDate: a.due_date,
      play: await loadPlayFor(supabase, a.play_id),
      questions: forPlayer(a.questions),
      result: r
        ? { score: r.score, total: r.total, message: resultMessage(r.score, r.total), feedback: feedbackFor(a.questions, r.answers) }
        : null,
    },
  };
}

export async function submitHomework(id: string, answers: unknown): Promise<{
  score?: number; total?: number; message?: string; feedback?: QuestionFeedback[]; error?: string;
}> {
  const { supabase, playerId, teamIds } = await myPlayer();
  if (!playerId) return { error: "Your profile isn't linked to a player yet." };

  const { data, error: readErr } = await supabase
    .from("homework_assignments")
    .select("id, team_id, questions")
    .eq("id", id)
    .in("team_id", teamIds)
    .maybeSingle();
  if (isMissingHomeworkTable(readErr)) return { error: "Homework isn't set up yet. Ask your coach." };
  if (!data) return { error: "This homework isn't for your team." };
  const questions = (data as { questions: HomeworkQuestion[] }).questions;

  const v = validateAnswers(questions, answers);
  if (!v.answers) return { error: v.error };

  const { error } = await supabase
    .from("homework_responses")
    .insert({ assignment_id: id, player_id: playerId, answers: v.answers });
  if (error?.code === "23505") return { error: "You've already done this one. Nice work!" };
  if (error) return { error: friendlyError(error, "Couldn't save your answers. Try again.") };

  const score = scoreAnswers(questions, v.answers);
  revalidatePath("/dashboard/player/homework");
  revalidatePath("/dashboard/player/development");
  return {
    score,
    total: questions.length,
    message: resultMessage(score, questions.length),
    feedback: feedbackFor(questions, v.answers),
  };
}

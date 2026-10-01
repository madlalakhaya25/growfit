import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { AgentStream } from "@/components/ai/agent-stream";

const AGENT_STARTERS = [
  "Who needs a welfare check-in?",
  "Which players are missing documents?",
  "What is our next fixture, and what do we know about the opponent?",
  "Suggest a drill for this week's training.",
];

export default async function CoachAgentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const ids = await getCoachedTeamIds(supabase, user.id);
  const { data } = ids.length
    ? await supabase.from("teams").select("id, name").in("id", ids).eq("active", true).order("created_at", { ascending: true })
    : { data: [] as { id: string; name: string }[] };
  const teams = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ask anything about your squad. It looks things up as it answers — attendance, fixtures, development,
          documents, welfare, drills — and links to the players and fixtures it mentions. It can only read; it never changes anything.
        </p>
      </div>
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a team yet. Create one in the Squad tab and the agent will have something to work with.
        </p>
      ) : (
        <AgentStream teams={teams} page="agent" starters={AGENT_STARTERS} />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachAssistantPanel } from "@/components/ai/coach-assistant-panel";
import { getAssistantContext } from "@/lib/assistant-context";

export default async function CoachAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { teams, roster, fixtures } = await getAssistantContext(supabase, user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assistant</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your assistant coach. It knows your squad — who is in form, who is missing
          training, what is coming up — so the advice is about your players, not
          football in general.
        </p>
      </div>

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have a team yet. Create one in the Squad tab and the assistant
          will have something to work with.
        </p>
      ) : (
        <CoachAssistantPanel teams={teams} fixtures={fixtures} roster={roster} />
      )}
    </div>
  );
}

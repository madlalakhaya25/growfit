"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { friendlyError } from "@/lib/friendly-error";

const announcementSchema = z.object({
  team_id: z.string().uuid("Invalid team"),
  title: z.string().min(1, "Title is required").max(100),
  body: z.string().min(1, "Message is required").max(2000),
});

async function getCoachTeamIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("teams")
    .select("id")
    .in("id", await getCoachedTeamIds(supabase, userId))
    .eq("active", true);
  return (data ?? []).map((t: { id: string }) => t.id);
}

export async function createAnnouncement(formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = {
    team_id: formData.get("team_id") as string,
    title: formData.get("title") as string,
    body: formData.get("body") as string,
  };
  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  // Verify coach owns this team
  const teamIds = await getCoachTeamIds(supabase, user.id);
  if (!teamIds.includes(parsed.data.team_id)) return { error: "Team not found." };

  const { error } = await supabase.from("announcements").insert({
    team_id: parsed.data.team_id,
    coach_id: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  if (error) return { error: friendlyError(error) };
  revalidateAnnouncementFeeds();
  return { success: true };
}

/**
 * Edit a published announcement.
 *
 * Announcements could be created and deleted but not edited, so fixing a
 * typo in a broadcast that had already reached every parent meant deleting
 * it and posting again — which re-notifies everyone and loses the read
 * receipts. The team is deliberately NOT editable: moving a post to another
 * squad would silently change who it was addressed to, after people have
 * already read it. Delete and repost is the right move for that.
 *
 * Scoped to the author (`coach_id = user.id`), matching deleteAnnouncement.
 */
export async function updateAnnouncement(id: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const parsed = announcementSchema
    .omit({ team_id: true })
    .safeParse({
      title: formData.get("title") as string,
      body: formData.get("body") as string,
    });
  if (!parsed.success) {
    const msgs = parsed.error.flatten().fieldErrors;
    return { error: Object.values(msgs).flat()[0] ?? "Invalid input." };
  }

  // `.select("id")` so a zero-row update is caught. An UPDATE that matches
  // nothing is not a PostgREST error, and reading the missing error as
  // success is exactly how the admin team edit silently did nothing.
  const { data, error } = await supabase
    .from("announcements")
    .update({ title: parsed.data.title, body: parsed.data.body })
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "You can only edit your own announcements." };
  revalidateAnnouncementFeeds();
  return { success: true };
}

export async function deleteAnnouncement(id: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");

  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Announcement not found." };
  revalidateAnnouncementFeeds();
  return { success: true };
}

export async function dismissAnnouncement(announcementId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("announcement_reads").upsert(
    { user_id: user.id, announcement_id: announcementId, dismissed_at: new Date().toISOString() },
    { onConflict: "user_id,announcement_id" }
  );

  if (error) return { error: friendlyError(error) };
  revalidatePath("/dashboard/player/announcements", "page");
  revalidatePath("/dashboard/parent/announcements", "page");
  return { success: true };
}

function revalidateAnnouncementFeeds() {
  revalidatePath("/dashboard/coach/announcements", "page");
  revalidatePath("/dashboard/player/announcements", "page");
  revalidatePath("/dashboard/parent/announcements", "page");
}

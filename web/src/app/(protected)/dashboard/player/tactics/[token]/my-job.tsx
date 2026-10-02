import { getMyPlayRole } from "@/app/actions/play-roles";

/**
 * "Your job in this play": the coach-approved explanation for the signed-in
 * player, or nothing at all. Renders no placeholder, so a play with no
 * approved text looks exactly as it did before.
 */
export async function MyJobInPlay({ token }: Readonly<{ token: string }>) {
  const { text } = await getMyPlayRole(token);
  if (!text) return null;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1">
      <p className="text-sm font-semibold">Your job in this play</p>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}

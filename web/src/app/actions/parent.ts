"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import {
  isCompleteParentLinkCode,
  isMissingParentLinkRpc,
  looksLikeAccessCode,
  MISSING_PARENT_LINK_RPC_MESSAGE,
  normalizeParentLinkCode,
  type ParentLinkCodeSummary,
  type RedeemParentLinkResult,
} from "@/lib/parent-link";

/**
 * Attach a parent to a child.
 *
 * This used to accept the child's `share_token` (or ID number, or MySAFA
 * number) and write `parent_player_links` directly. All three are things a
 * stranger can come by — the share token is literally the public passport URL
 * and is printed on the PDF player card — and the row it wrote granted read
 * AND write access to the child's medical record. See migration 032.
 *
 * Now the only way in is a code a coach or admin issued for that specific
 * child. The check that matters lives in the database: `redeem_parent_link_code`
 * is SECURITY DEFINER, and the RLS policy it replaced is gone, so this action
 * is a thin caller rather than the security boundary.
 */
export async function linkChild(formData: FormData) {
  const { supabase } = await requireUser();

  const raw = (formData.get("code") as string) ?? "";
  const relationship = (formData.get("relationship") as string) || "Parent";
  const code = normalizeParentLinkCode(raw);

  if (!code) return { error: "Enter the link code your child's coach gave you." };

  // A club/team code is 6 characters and a child link code is 10. Someone
  // pasting the wrong one deserves to be told which, not "invalid code".
  if (looksLikeAccessCode(raw)) {
    return {
      error:
        "That looks like a club or team code, not a child link code. " +
        "Ask your child's coach for a link code — it is 10 characters.",
    };
  }

  if (!isCompleteParentLinkCode(raw)) {
    return { error: "A child link code is 10 characters. Check it and try again." };
  }

  const { data, error } = await supabase.rpc("redeem_parent_link_code", {
    p_code: code,
    p_relationship: relationship,
  });

  // Fail CLOSED when migration 032 has not been run. Falling back to the old
  // direct insert would ship the vulnerability this replaces.
  if (isMissingParentLinkRpc(error)) {
    return { error: MISSING_PARENT_LINK_RPC_MESSAGE };
  }
  if (error) return { error: friendlyError(error) };

  const result = data as RedeemParentLinkResult | null;
  if (!result || result.error) {
    return { error: result?.error ?? "Could not link your child." };
  }

  revalidatePath("/dashboard/parent");
  redirect("/dashboard/parent");
}

/**
 * Staff issue a one-time link code for a child. The plaintext comes back
 * exactly once — it is stored hashed — so the caller must show it immediately.
 */
export async function issueParentLinkCode(playerId: string, relationship?: string) {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("issue_parent_link_code", {
    p_player_id: playerId,
    p_relationship: relationship || null,
  });

  if (isMissingParentLinkRpc(error)) return { error: MISSING_PARENT_LINK_RPC_MESSAGE };
  if (error) return { error: friendlyError(error) };

  const result = data as { success?: boolean; code?: string; expires_at?: string; error?: string } | null;
  if (!result || result.error) return { error: result?.error ?? "Could not create a code." };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  revalidatePath(`/dashboard/admin/players/${playerId}`);
  return { success: true as const, code: result.code, expiresAt: result.expires_at };
}

export async function listParentLinkCodes(playerId: string) {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("list_parent_link_codes", {
    p_player_id: playerId,
  });

  if (isMissingParentLinkRpc(error)) return { error: MISSING_PARENT_LINK_RPC_MESSAGE };
  if (error) return { error: friendlyError(error) };

  const result = data as { success?: boolean; codes?: ParentLinkCodeSummary[]; error?: string } | null;
  if (!result || result.error) return { error: result?.error ?? "Could not load codes." };

  return { success: true as const, codes: result.codes ?? [] };
}

export async function revokeParentLinkCode(codeId: string, playerId: string) {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("revoke_parent_link_code", { p_id: codeId });

  if (isMissingParentLinkRpc(error)) return { error: MISSING_PARENT_LINK_RPC_MESSAGE };
  if (error) return { error: friendlyError(error) };

  const result = data as { success?: boolean; error?: string } | null;
  if (!result || result.error) return { error: result?.error ?? "Could not revoke that code." };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  revalidatePath(`/dashboard/admin/players/${playerId}`);
  return { success: true as const };
}

/**
 * Remove an adult's access to a child. Staff-initiated; a parent removing
 * their own link goes through the `parent_link_delete` policy instead.
 */
export async function unlinkParent(parentId: string, playerId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("parent_player_links")
    .delete()
    .eq("parent_id", parentId)
    .eq("player_id", playerId);

  if (error) return { error: friendlyError(error) };

  revalidatePath(`/dashboard/coach/squad/${playerId}`);
  revalidatePath(`/dashboard/admin/players/${playerId}`);
  return { success: true as const };
}

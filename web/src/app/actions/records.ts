"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { friendlyError } from "@/lib/friendly-error";
import { AVAILABILITY_STATUSES, type AvailabilityStatus } from "@/lib/types";

/**
 * Record whether a player is currently available to play — separate from
 * their registration/active status. Squad selection (by hand, in
 * LogResultForm, and by the AI's suggestLineup/generateMatchPlan) reads
 * this so an injured child isn't offered as an option in the first place.
 *
 * No app-level ownership check beyond `requireUser()`: this is one field on
 * `players`, and `player_staff_update` RLS (academy_id = auth_academy_id()
 * AND is_admin_or_coach()) already governs writes to the row exactly as it
 * does for every other field savePlayerExtendedInfo/savePlayerMedical touch
 * above and below — the same trust boundary, not a new one.
 */
export async function setPlayerAvailability(
  playerId: string,
  status: AvailabilityStatus,
  note?: string
) {
  const { supabase, user } = await requireUser();

  if (!AVAILABILITY_STATUSES.some((s) => s.value === status)) {
    return { error: "Invalid availability status." };
  }

  const { error } = await supabase
    .from("players")
    .update({
      availability_status: status,
      // Available means nothing to add — an old injury note shouldn't
      // linger and read as still true once the status has moved on.
      availability_note: status === "available" ? null : (note?.trim().slice(0, 200) || null),
      availability_updated_at: new Date().toISOString(),
      availability_updated_by: user.id,
    })
    .eq("id", playerId);

  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  revalidatePath(`/dashboard/coach/squad/${playerId}`, "page");
  revalidatePath("/dashboard/coach/squad", "page");
  return { success: true };
}

export async function savePlayerExtendedInfo(playerId: string, data: {
  school?: string;
  home_address?: string;
  id_number?: string;
  mysafa_number?: string;
}) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("players").update(data).eq("id", playerId);
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  return { success: true };
}

export async function savePlayerMedical(playerId: string, data: {
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medication?: string;
  condition_notes?: string;
  physical_restrictions?: string;
  emergency_1_name?: string;
  emergency_1_relationship?: string;
  emergency_1_phone?: string;
  emergency_2_name?: string;
  emergency_2_relationship?: string;
  emergency_2_phone?: string;
  has_medical_aid?: boolean;
  medical_aid_scheme?: string;
  medical_aid_number?: string;
  medical_aid_principal?: string;
  doctor_clinic?: string;
  nearest_hospital?: string;
  treatment_authorised?: boolean;
  authorised_by?: string;
  season?: string;
}) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("player_medical").upsert(
    {
      player_id: playerId,
      ...data,
      authorised_at: data.treatment_authorised ? new Date().toISOString() : null,
      needs_renewal: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  revalidatePath("/dashboard/parent", "page");
  return { success: true };
}

export async function savePlayerConsents(
  playerId: string,
  season: string,
  data: {
    participation_consent: boolean;
    photo_consent: boolean;
    transport_consent: boolean;
    risk_acknowledged: boolean;
    signed_by: string;
  }
) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("player_consents").upsert(
    { player_id: playerId, season, ...data, signed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "player_id,season" }
  );
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  return { success: true };
}

export async function signDocumentDigitally(
  playerId: string,
  documentType: string,
  season: string,
  signerName: string,
  signerRole: string
) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("player_documents").upsert(
    {
      player_id: playerId,
      document_type: documentType,
      season,
      signed_digitally: true,
      signer_name: signerName,
      signer_role: signerRole,
      signed_at: new Date().toISOString(),
      status: "signed",
    },
    { onConflict: "player_id,document_type,season" }
  );
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  revalidatePath("/dashboard/parent", "page");
  revalidatePath("/dashboard/player", "page");
  return { success: true };
}

export async function uploadDocumentScan(formData: FormData) {
  const { supabase, user } = await requireUser();

  const playerId       = formData.get("player_id") as string;
  const documentType   = formData.get("document_type") as string;
  const season         = formData.get("season") as string;
  const file           = formData.get("file") as File;

  if (!file?.size || !playerId || !documentType || !season)
    return { error: "Missing required fields." };

  if (file.size > 10 * 1024 * 1024) return { error: "File must be under 10 MB." };

  const ext  = file.name.split(".").pop() ?? "pdf";
  const path = `${playerId}/${documentType}/${season}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("player-documents")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) return { error: friendlyError(upErr, "Couldn't upload that document.") };

  const { data: { publicUrl } } = supabase.storage
    .from("player-documents")
    .getPublicUrl(path);

  const { error } = await supabase.from("player_documents").upsert(
    {
      player_id: playerId,
      document_type: documentType,
      season,
      upload_url: publicUrl,
      file_name: file.name,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user.id,
      status: "uploaded",
    },
    { onConflict: "player_id,document_type,season" }
  );
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  revalidatePath("/dashboard/parent", "page");
  revalidatePath("/dashboard/player", "page");
  return { success: true };
}

export async function signConsentDocument(
  playerId: string,
  season: string,
  signerName: string,
  consents: {
    participation_consent: boolean;
    photo_consent: boolean;
    transport_consent: boolean;
    risk_acknowledged: boolean;
  }
) {
  const { supabase } = await requireUser();

  const { error: docErr } = await supabase.from("player_documents").upsert(
    {
      player_id: playerId,
      document_type: "consent_form",
      season,
      signed_digitally: true,
      signer_name: signerName,
      signer_role: "parent",
      signed_at: new Date().toISOString(),
      status: "signed",
    },
    { onConflict: "player_id,document_type,season" }
  );
  if (docErr) return { error: friendlyError(docErr) };

  const { error: consentErr } = await supabase.from("player_consents").upsert(
    {
      player_id: playerId,
      season,
      ...consents,
      signed_by: signerName,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,season" }
  );
  if (consentErr) return { error: friendlyError(consentErr) };

  revalidatePath(`/dashboard/admin/players/${playerId}`, "page");
  revalidatePath("/dashboard/parent", "page");
  revalidatePath("/dashboard/player", "page");
  return { success: true };
}

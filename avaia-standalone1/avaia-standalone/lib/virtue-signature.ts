import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";

// AVAIA Virtue Signature -- source-based implementation. See migration
// 0044's own header for the full provenance trail (original AVAIA source
// material, recovered and read directly, not invented). This module owns
// the record/query helpers; the six layers, "other people can provide
// evidence, not identity," and "living record, not frozen" are the
// governing facts everything here protects.

export type SignatureLayer =
  | "recognize_in_myself"
  | "others_noticed"
  | "qualities_together"
  | "different_expressions"
  | "want_to_practice"
  | "want_to_contribute";

export const SIGNATURE_LAYER_LABEL: Record<SignatureLayer, string> = {
  recognize_in_myself: "What I Recognize in Myself",
  others_noticed: "What Other People Have Noticed",
  qualities_together: "How My Qualities Work Together",
  different_expressions: "Different Ways the Same Quality Can Show Up",
  want_to_practice: "What I Want to Practice",
  want_to_contribute: "How I Want to Contribute",
};

export const SIGNATURE_LAYER_ORDER: SignatureLayer[] = [
  "recognize_in_myself",
  "others_noticed",
  "qualities_together",
  "different_expressions",
  "want_to_practice",
  "want_to_contribute",
];

export type SignatureSourceType = "self" | "conversation_referral" | "unsung_heroes" | "observation_offered";

export type VirtueSignatureEntry = {
  id: string;
  host_id: string | null;
  guide_participant_id: string | null;
  layer: SignatureLayer;
  family: string;
  element: string | null;
  note: string | null;
  source_type: SignatureSourceType;
  source_reference: string | null;
  status: "active" | "removed";
  created_at: string;
  updated_at: string;
};

/** The two elements the recovered source material names as Identity's
 *  fixed first ring -- both already-canonical Integrity elements
 *  (confirmed against lib/virtues.ts before this was written), never
 *  something a Host adds or removes themselves. Every other ring is the
 *  Host's own living, editable record. */
export const IDENTITY_FIRST_RING: { family: string; element: string }[] = [
  { family: "Integrity", element: "Vulnerability" },
  { family: "Integrity", element: "Authenticity" },
];

/** Adds one entry to a self-serve Host's own Signature. `supabase` must be
 *  the caller's own RLS-scoped client -- RLS enforces host_id = auth.uid()
 *  regardless. family/element are validated against the canonical
 *  Chemistry of Virtue before insert; an invalid pair is rejected rather
 *  than silently stored, matching the same backstop referral generation
 *  and Unsung Heroes already apply. */
export async function addSignatureEntryForHost(
  supabase: SupabaseClient,
  hostId: string,
  layer: SignatureLayer,
  family: string,
  element: string | null,
  note: string | null,
  sourceType: SignatureSourceType,
  sourceReference: string | null
): Promise<{ error: string | null }> {
  if (!isValidVirtueFamily(family)) return { error: "Not a real Chemistry of Virtue family." };
  if (element && !isValidVirtueElement(family, element)) {
    return { error: "Not a real Chemistry of Virtue element for that family." };
  }
  const { error } = await supabase.from("virtue_signature_entries").insert({
    host_id: hostId,
    layer,
    family,
    element,
    note,
    source_type: sourceType,
    source_reference: sourceReference,
  });
  return { error: error?.message ?? null };
}

/** Same as addSignatureEntryForHost, for a Guide-facilitated participant.
 *  `supabase` must be the Guide's own RLS-scoped client -- RLS enforces
 *  the participant belongs to this Guide. */
export async function addSignatureEntryForParticipant(
  supabase: SupabaseClient,
  participantId: string,
  layer: SignatureLayer,
  family: string,
  element: string | null,
  note: string | null,
  sourceType: SignatureSourceType,
  sourceReference: string | null
): Promise<{ error: string | null }> {
  if (!isValidVirtueFamily(family)) return { error: "Not a real Chemistry of Virtue family." };
  if (element && !isValidVirtueElement(family, element)) {
    return { error: "Not a real Chemistry of Virtue element for that family." };
  }
  const { error } = await supabase.from("virtue_signature_entries").insert({
    guide_participant_id: participantId,
    layer,
    family,
    element,
    note,
    source_type: sourceType,
    source_reference: sourceReference,
  });
  return { error: error?.message ?? null };
}

/** The Host deciding something no longer belongs -- a status flip, not a
 *  delete, so their own history of what they once recognized and later
 *  revised isn't erased. RLS (host_id or guide_participant_id ownership)
 *  is the only access check; this function trusts the caller's own
 *  RLS-scoped client entirely. */
export async function removeSignatureEntry(supabase: SupabaseClient, entryId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("virtue_signature_entries")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", entryId);
  return { error: error?.message ?? null };
}

async function listEntries(
  supabase: SupabaseClient,
  column: "host_id" | "guide_participant_id",
  id: string
): Promise<VirtueSignatureEntry[]> {
  const { data } = await supabase
    .from("virtue_signature_entries")
    .select("*")
    .eq(column, id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return (data as VirtueSignatureEntry[]) ?? [];
}

export async function listSignatureEntriesForHost(supabase: SupabaseClient, hostId: string) {
  return listEntries(supabase, "host_id", hostId);
}

export async function listSignatureEntriesForParticipant(supabase: SupabaseClient, participantId: string) {
  return listEntries(supabase, "guide_participant_id", participantId);
}

/** Groups active entries by their six layers, in the source material's own
 *  order -- what components/VirtueSignatureRecord.tsx and the Noble Gas
 *  visual both read from. */
export function groupByLayer(entries: VirtueSignatureEntry[]): Record<SignatureLayer, VirtueSignatureEntry[]> {
  const grouped = Object.fromEntries(SIGNATURE_LAYER_ORDER.map((l) => [l, [] as VirtueSignatureEntry[]])) as Record<
    SignatureLayer,
    VirtueSignatureEntry[]
  >;
  for (const e of entries) {
    if (grouped[e.layer]) grouped[e.layer].push(e);
  }
  return grouped;
}

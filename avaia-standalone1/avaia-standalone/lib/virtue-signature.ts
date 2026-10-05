import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";
import {
  type SignatureSourceType,
  type SignatureElement,
  type VirtueSignatureEntry,
  IDENTITY_FIRST_RING,
  NEXT_RING_CAPACITY,
  groupByElement,
} from "@/lib/virtue-signature-constants";

// AVAIA Virtue Signature. This module owns the record/query helpers. The governing
// facts everything here protects: the Host authors it, "other people can provide
// evidence, not identity," it is a living record (not frozen), and it becomes visible
// through repeated experiences, repeated expressions and different scenarios. See the
// header of lib/virtue-signature-constants.ts for the Founder-governed structure and for
// why the old six "layers" were removed. Plain types/constants live in
// lib/virtue-signature-constants.ts (not server-only) and are re-exported
// here for server code's convenience, see that file's own header for why.

export { IDENTITY_FIRST_RING, NEXT_RING_CAPACITY, groupByElement };
export type { SignatureSourceType, SignatureElement, VirtueSignatureEntry };

/** Adds one entry to a self-serve Host's own Signature. `supabase` must be
 *  the caller's own RLS-scoped client, RLS enforces host_id = auth.uid()
 *  regardless. family/element are validated against the canonical
 *  Chemistry of Virtue before insert; an invalid pair is rejected rather
 *  than silently stored, matching the same backstop referral generation
 *  and Unsung Heroes already apply. */
export async function addSignatureEntryForHost(
  supabase: SupabaseClient,
  hostId: string,
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
    family,
    element,
    note,
    source_type: sourceType,
    source_reference: sourceReference,
  });
  return { error: error?.message ?? null };
}

/** A Guide cannot write a participant's Signature (Move 7): there is no function for it and
 *  the database has no Guide write policy. A Guide can only offer an item back to the
 *  participant (lib/ops/kept-items.ts), and the participant decides what to keep.
 *
 *  The Host deciding something no longer belongs, a status flip, not a
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


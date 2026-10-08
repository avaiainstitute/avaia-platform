import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { referralItemText } from "@/lib/kept-items";
import {
  defaultKindForField,
  isCoordinateFromField,
  isUuid,
  summarizeItems,
  todayIso,
  type CoordinateFromField,
  type CoordinationInput,
  type CoordinationItem,
  type CoordinationKind,
  type CoordinationStatus,
  type CoordinationSummary,
} from "@/lib/coordination";

// COORDINATION (the I/O side), Workbook Phase 1. See lib/coordination.ts for the rules and
// supabase/migrations/0120_coordination_items.sql for the database's own protections.
//
// Privacy posture of this file:
//  * Every call runs on the signed-in Host's OWN RLS-bound client. There is no admin or
//    service-role client anywhere in this module, so a mistake here cannot read another Host's
//    items, and the database independently refuses anything that is not the Host's own.
//  * It stores ids and the Host's own words only. It never reads or copies a message, a Journal
//    entry or a Room. A related conversation or referral is a pointer; the text of one referral
//    field is read only when the Host presses "Add to Coordination" on it, and only to prefill a
//    title the Host can change before anything is saved.
//  * Nothing is inferred. Every state is whatever the Host selected.
//  * Adults only in this release: a self-serve Youth profile is refused here and by the database.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

const COLUMNS =
  "id, host_id, kind, title, category, delegation_state, assigned_to_name, assigned_to_role, professional_name, professional_role, status, waiting_on, waiting_on_note, next_action, due_date, related_decision_id, related_conversation_id, related_referral_id, related_room_label, created_at, updated_at, closed_at";

type DbError = { code?: string; message?: string } | null | undefined;

function friendly(error: DbError): string {
  switch (error?.code) {
    case "23514":
      return "One of those entries is not allowed. Please check the title, the dates and the waiting choice.";
    case "23503":
      return "Something this item points to could not be found.";
    case "42501":
      return "That is not available on this account.";
    default:
      return "That could not be saved. Please try again.";
  }
}

/** The gate for every Coordination page and action: signed in, consent given, and an adult
 *  account. Anyone else is sent where the rest of the Workbook already sends them. Returns the
 *  Host's own RLS-bound client. */
export async function requireCoordinationHost(from: string): Promise<{ supabase: SupabaseClient; hostId: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${from}`);
  const { data: profile } = await supabase.from("profiles").select("consent_at, developmental_band").eq("id", user.id).maybeSingle();
  const row = profile as { consent_at: string | null; developmental_band: string | null } | null;
  if (!row?.consent_at) redirect("/welcome");
  // Adults only in this release (Phase 1): a self-serve Youth profile is sent back to the Workbook.
  if (row.developmental_band) redirect("/workbook");
  return { supabase, hostId: user.id };
}

/** Coordination is for adult account holders in this release. A self-serve Youth profile carries a
 *  developmental band; adults do not. */
export async function isAdultHost(supabase: SupabaseClient, hostId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("developmental_band").eq("id", hostId).maybeSingle();
  return !(data as { developmental_band: string | null } | null)?.developmental_band;
}

/** Conversation ids the Host facilitated for someone else (a Guide's own account carries them).
 *  The Workbook already treats these as not the Host's own story; so does Coordination. */
async function facilitatedConversationIds(supabase: SupabaseClient, hostId: string): Promise<Set<string>> {
  const { data } = await supabase.from("guide_sessions").select("conversation_id").eq("guide_id", hostId);
  return new Set(((data ?? []) as { conversation_id: string | null }[]).map((r) => r.conversation_id).filter((v): v is string => !!v));
}

export async function listCoordinationItems(supabase: SupabaseClient, hostId: string): Promise<CoordinationItem[]> {
  const { data, error } = await supabase
    .from("coordination_items")
    .select(COLUMNS)
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordinationItem[];
}

export async function getCoordinationItem(supabase: SupabaseClient, hostId: string, itemId: string): Promise<CoordinationItem | null> {
  if (!isUuid(itemId)) return null;
  const { data } = await supabase.from("coordination_items").select(COLUMNS).eq("id", itemId).eq("host_id", hostId).maybeSingle();
  return (data as CoordinationItem | null) ?? null;
}

/** Counts for the Workbook's Coordination section. Never throws: a failure here must not take the
 *  rest of the Workbook down. */
export async function coordinationSummaryForHost(supabase: SupabaseClient, hostId: string): Promise<CoordinationSummary | null> {
  try {
    const { data, error } = await supabase.from("coordination_items").select("status, due_date").eq("host_id", hostId);
    if (error) return null;
    return summarizeItems((data ?? []) as Pick<CoordinationItem, "status" | "due_date">[], todayIso());
  } catch {
    return null;
  }
}

export type PointerChoices = {
  conversations: { id: string; stage: string; created_at: string }[];
  referrals: { id: string; from_stage: string; created_at: string }[];
};

/** The Host's own recent conversations and referrals, offered as things an item can point to.
 *  Conversations a Guide facilitated for someone else are never offered. */
export async function listPointerChoices(supabase: SupabaseClient, hostId: string): Promise<PointerChoices> {
  const facilitated = await facilitatedConversationIds(supabase, hostId);
  const [convos, refs] = await Promise.all([
    supabase.from("conversations").select("id, stage, created_at").eq("host_id", hostId).order("created_at", { ascending: false }).limit(60),
    supabase.from("referrals").select("id, from_stage, conversation_id, created_at").eq("host_id", hostId).order("created_at", { ascending: false }).limit(60),
  ]);
  return {
    conversations: ((convos.data ?? []) as { id: string; stage: string; created_at: string }[]).filter((c) => !facilitated.has(c.id)),
    referrals: ((refs.data ?? []) as { id: string; from_stage: string; conversation_id: string | null; created_at: string }[])
      .filter((r) => !r.conversation_id || !facilitated.has(r.conversation_id))
      .map((r) => ({ id: r.id, from_stage: r.from_stage, created_at: r.created_at })),
  };
}

export type SeedFromReferral = {
  text: string;
  referralId: string;
  conversationId: string | null;
  field: CoordinateFromField;
  kind: CoordinationKind;
};

/** "Add to Coordination" on one decision or commitment in the Host's own referral. The text is
 *  read here from the stored record (never accepted from a browser) with the same rule Keep this
 *  uses, only to prefill a title the Host can change. Nothing is saved by this call. */
export async function resolveSeedFromReferral(
  supabase: SupabaseClient,
  hostId: string,
  referralId: string,
  field: string,
  index: number
): Promise<Result<{ seed: SeedFromReferral }>> {
  if (!isUuid(referralId) || !isCoordinateFromField(field) || !Number.isInteger(index) || index < 0) {
    return { ok: false, error: "That item could not be found." };
  }
  const { data } = await supabase.from("referrals").select("id, conversation_id, content").eq("id", referralId).eq("host_id", hostId).maybeSingle();
  const row = data as { id: string; conversation_id: string | null; content: unknown } | null;
  if (!row) return { ok: false, error: "That item could not be found." };
  if (row.conversation_id && (await facilitatedConversationIds(supabase, hostId)).has(row.conversation_id)) {
    return { ok: false, error: "That item could not be found." };
  }
  const text = referralItemText(row.content, field, index);
  if (!text) return { ok: false, error: "That item could not be found." };
  return { ok: true, seed: { text, referralId: row.id, conversationId: row.conversation_id, field, kind: defaultKindForField(field) } };
}

export type Pointers = {
  /** undefined = leave as is; null = clear; string = set (must be the Host's own). */
  conversationId?: string | null;
  referralId?: string | null;
};

async function validatePointers(supabase: SupabaseClient, hostId: string, pointers: Pointers): Promise<Result> {
  const facilitated = await facilitatedConversationIds(supabase, hostId);
  if (pointers.conversationId) {
    if (!isUuid(pointers.conversationId) || facilitated.has(pointers.conversationId)) return { ok: false, error: "That conversation could not be found." };
    const { data } = await supabase.from("conversations").select("id").eq("id", pointers.conversationId).eq("host_id", hostId).maybeSingle();
    if (!data) return { ok: false, error: "That conversation could not be found." };
  }
  if (pointers.referralId) {
    if (!isUuid(pointers.referralId)) return { ok: false, error: "That referral could not be found." };
    const { data } = await supabase.from("referrals").select("id, conversation_id").eq("id", pointers.referralId).eq("host_id", hostId).maybeSingle();
    const r = data as { id: string; conversation_id: string | null } | null;
    if (!r || (r.conversation_id && facilitated.has(r.conversation_id))) return { ok: false, error: "That referral could not be found." };
  }
  return { ok: true };
}

/** A related decision must be another decision item of the same Host. (The database also refuses a
 *  link to another Host's item; this adds the "must be a decision" rule.) */
async function validateRelatedDecision(supabase: SupabaseClient, hostId: string, relatedId: string | null, selfId: string | null): Promise<Result> {
  if (!relatedId) return { ok: true };
  if (selfId && relatedId === selfId) return { ok: false, error: "An item cannot relate to itself." };
  const { data } = await supabase.from("coordination_items").select("id, kind").eq("id", relatedId).eq("host_id", hostId).maybeSingle();
  if (!data || (data as { kind: string }).kind !== "decision") return { ok: false, error: "Choose one of your own decisions to relate this to." };
  return { ok: true };
}

export async function createCoordinationItem(
  supabase: SupabaseClient,
  hostId: string,
  input: CoordinationInput,
  pointers: Pointers = {}
): Promise<Result<{ id: string }>> {
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "Coordination is available to adult accounts in this release." };
  const related = await validateRelatedDecision(supabase, hostId, input.related_decision_id, null);
  if (!related.ok) return related;
  const pointerCheck = await validatePointers(supabase, hostId, pointers);
  if (!pointerCheck.ok) return pointerCheck;

  const { data, error } = await supabase
    .from("coordination_items")
    .insert({
      host_id: hostId,
      ...input,
      related_conversation_id: pointers.conversationId ?? null,
      related_referral_id: pointers.referralId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: friendly(error) };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateCoordinationItem(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  input: CoordinationInput,
  pointers: Pointers = {}
): Promise<Result> {
  if (!isUuid(itemId)) return { ok: false, error: "That item could not be found." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "Coordination is available to adult accounts in this release." };
  const related = await validateRelatedDecision(supabase, hostId, input.related_decision_id, itemId);
  if (!related.ok) return related;
  const pointerCheck = await validatePointers(supabase, hostId, pointers);
  if (!pointerCheck.ok) return pointerCheck;

  const patch: Record<string, unknown> = { ...input };
  if (pointers.conversationId !== undefined) patch.related_conversation_id = pointers.conversationId;
  if (pointers.referralId !== undefined) patch.related_referral_id = pointers.referralId;

  const { data, error } = await supabase.from("coordination_items").update(patch).eq("id", itemId).eq("host_id", hostId).select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data || data.length === 0) return { ok: false, error: "That item could not be found." };
  return { ok: true };
}

/** Close or reopen. Closing keeps the item (there is no delete in Phase 1); reopening makes it Open. */
export async function setCoordinationStatus(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  status: Extract<CoordinationStatus, "open" | "closed">
): Promise<Result> {
  if (!isUuid(itemId)) return { ok: false, error: "That item could not be found." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "Coordination is available to adult accounts in this release." };
  const { data, error } = await supabase
    .from("coordination_items")
    .update({ status, waiting_on: null, waiting_on_note: null })
    .eq("id", itemId)
    .eq("host_id", hostId)
    .select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data || data.length === 0) return { ok: false, error: "That item could not be found." };
  return { ok: true };
}

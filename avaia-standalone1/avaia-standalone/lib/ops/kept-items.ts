import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedGuideRoom } from "@/lib/guide";
import { toolLabel } from "@/lib/toolkit";
import {
  HOST_VOICE_LABEL,
  guideMayWithdraw,
  hostMayConfirmParticipant,
  hostMayKeepOffer,
  hostMaySeeOfferedItem,
  isOfferableField,
  keptSourceKey,
  offerSourceKey,
  participantIsReachable,
  recognitionKeptText,
  referralItemText,
  type HostIdentity,
  type KeptKind,
  type OfferState,
} from "@/lib/kept-items";

// KEEP THIS (the I/O side). A Host intentionally carries an item from an AVAIA
// experience into their own continuing record. A Guide may OFFER something back; only
// the Host's own action creates a kept item. See lib/kept-items.ts for the rules.
//
// Privacy posture of this file:
//  * Text is always resolved here from the stored record, never accepted from a browser.
//  * An offer is a pointer and a label. The Host sees metadata, then confirms the session
//    is theirs, and only then is the text resolved for them.
//  * Nothing here keeps anything automatically, and nothing here reads a conversation's
//    messages: only one referral field or one recognition at a time, on the Host's own act.
//  * The Guide's client can only create and withdraw waiting offers (RLS); every Host step
//    runs on the service role AFTER the Host's identity and confirmation are re-verified.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

export type KeptItem = {
  id: string;
  kind: KeptKind;
  label: string;
  content: string;
  source_type: string;
  from_guide_name: string | null;
  from_session_date: string | null;
  status: "active" | "removed";
  created_at: string;
};

// ---------------------------------------------------------------------------
// The Host's own record
// ---------------------------------------------------------------------------

export async function listKeptItems(supabase: SupabaseClient, hostId: string): Promise<KeptItem[]> {
  const { data } = await supabase
    .from("kept_items")
    .select("id, kind, label, content, source_type, from_guide_name, from_session_date, status, created_at")
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  return (data ?? []) as KeptItem[];
}

/** Inserts a kept row, or restores one the Host had earlier taken out. Idempotent. */
async function writeKept(
  client: SupabaseClient,
  row: {
    host_id: string;
    kind: KeptKind;
    label: string;
    content: string;
    source_type: "journey_conversation" | "unsung_heroes_recognition" | "guide_offer";
    source_reference: string;
    source_key: string;
    from_guide_id?: string | null;
    from_guide_name?: string | null;
    from_session_date?: string | null;
  }
): Promise<Result> {
  const { data: existing } = await client.from("kept_items").select("id, status").eq("host_id", row.host_id).eq("source_key", row.source_key).maybeSingle();
  if (existing) {
    if ((existing as { status: string }).status === "removed") {
      const { error } = await client.from("kept_items").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id);
      if (error) return { ok: false, error: "Could not keep this." };
    }
    return { ok: true };
  }
  const { error } = await client.from("kept_items").insert(row);
  return error ? { ok: false, error: "Could not keep this." } : { ok: true };
}

/** "Keep this" on one of the Host's own Journey items. `supabase` is the Host's own
 *  RLS-bound client: the referral is read only if it is theirs. */
export async function keepFromJourney(supabase: SupabaseClient, hostId: string, conversationId: string, field: string, index: number): Promise<Result> {
  if (!isOfferableField(field) || !Number.isInteger(index) || index < 0) return { ok: false, error: "That cannot be kept." };
  const { data } = await supabase.from("referrals").select("content").eq("conversation_id", conversationId).eq("host_id", hostId).maybeSingle();
  const text = referralItemText((data as { content?: unknown } | null)?.content, field, index);
  if (!text) return { ok: false, error: "That item could not be found." };
  return writeKept(supabase, {
    host_id: hostId,
    kind: "host_voice",
    label: HOST_VOICE_LABEL[field],
    content: text,
    source_type: "journey_conversation",
    source_reference: conversationId,
    source_key: keptSourceKey({ sourceType: "journey_conversation", sourceReference: conversationId, field, index }),
  });
}

/** "Keep this" on one of the Host's own Unsung Heroes recognitions. */
export async function keepFromRecognition(supabase: SupabaseClient, hostId: string, recognitionId: string): Promise<Result> {
  const { data } = await supabase.from("recognitions").select("id, title, who_became_visible, observer_id, observed_user_id").eq("id", recognitionId).maybeSingle();
  const r = data as { id: string; title: string; who_became_visible: string; observer_id: string; observed_user_id: string | null } | null;
  if (!r || (r.observer_id !== hostId && r.observed_user_id !== hostId)) return { ok: false, error: "That recognition could not be found." };
  return writeKept(supabase, {
    host_id: hostId,
    kind: "recognition",
    label: "Recognition",
    content: recognitionKeptText(r),
    source_type: "unsung_heroes_recognition",
    source_reference: r.id,
    source_key: keptSourceKey({ sourceType: "unsung_heroes_recognition", sourceReference: r.id }),
  });
}

/** The Host taking an item back out of (or returning it to) their record. */
export async function setKeptStatus(supabase: SupabaseClient, itemId: string, status: "active" | "removed"): Promise<Result> {
  const { error } = await supabase.from("kept_items").update({ status, updated_at: new Date().toISOString() }).eq("id", itemId);
  return error ? { ok: false, error: "Could not update that item." } : { ok: true };
}

// ---------------------------------------------------------------------------
// The Guide's side: offer, never decide
// ---------------------------------------------------------------------------

export type OfferRequest = { kind: "field"; field: string; index: number } | { kind: "recognition"; recognitionId: string };

/** The Guide offers items from one of their own sessions back to the participant. `supabase`
 *  is the Guide's own client: RLS lets them create only a waiting offer, for their own
 *  participant and session. An offer holds a pointer and a label, never the text. */
export async function offerItems(args: { supabase: SupabaseClient; guideId: string; participantId: string; sessionId: string; items: OfferRequest[] }): Promise<Result<{ offered: number; alreadyOffered: number }>> {
  const { supabase, guideId, participantId, sessionId, items } = args;
  if (items.length === 0) return { ok: false, error: "Choose at least one item to offer." };
  if (!(await isAuthorizedGuideRoom(supabase, guideId))) return { ok: false, error: "You are not currently authorized to do this." };

  const { data: participant } = await supabase.from("guide_participants").select("id, email, linked_host_id, developmental_band").eq("id", participantId).eq("guide_id", guideId).maybeSingle();
  if (!participant) return { ok: false, error: "Participant not found." };
  // Youth participants are not part of this: Youth Guide facilitation stays on hold pending its
  // own guardian-consent architecture, and nothing here widens what reaches a minor's account.
  if ((participant as { developmental_band?: string | null }).developmental_band) {
    return { ok: false, error: "Offers are not available for Youth participants." };
  }
  if (!participantIsReachable(participant as { email: string | null; linked_host_id: string | null })) {
    return { ok: false, error: "There is no email on file for this person, so there is no account an offer could ever reach. Add their email first." };
  }
  const { data: session } = await supabase.from("guide_sessions").select("id, tool, conversation_id, participant_id").eq("id", sessionId).eq("guide_id", guideId).maybeSingle();
  const s = session as { id: string; tool: string; conversation_id: string | null; participant_id: string | null } | null;
  if (!s || s.participant_id !== participantId || !s.conversation_id) return { ok: false, error: "That session could not be found for this participant." };

  let referralContent: unknown = null;
  if (items.some((i) => i.kind === "field")) {
    const { data } = await supabase.from("referrals").select("content").eq("conversation_id", s.conversation_id).maybeSingle();
    referralContent = (data as { content?: unknown } | null)?.content ?? null;
  }

  const rows: Record<string, unknown>[] = [];
  for (const item of items) {
    if (item.kind === "field") {
      if (!isOfferableField(item.field) || referralItemText(referralContent, item.field, item.index) === null) return { ok: false, error: "One of those items could not be found in this session." };
      rows.push({
        guide_id: guideId,
        participant_id: participantId,
        session_id: sessionId,
        source_type: "referral_field",
        field: item.field,
        item_index: item.index,
        label: HOST_VOICE_LABEL[item.field],
        source_key: offerSourceKey({ sessionId, sourceType: "referral_field", field: item.field, index: item.index }),
      });
    } else {
      if (s.tool !== "unsung-heroes") return { ok: false, error: "That session has no recognition to offer." };
      const { data: rec } = await supabase.from("recognitions").select("id").eq("id", item.recognitionId).eq("conversation_id", s.conversation_id).maybeSingle();
      if (!rec) return { ok: false, error: "That recognition could not be found in this session." };
      rows.push({
        guide_id: guideId,
        participant_id: participantId,
        session_id: sessionId,
        source_type: "recognition",
        recognition_id: item.recognitionId,
        label: "Recognition",
        source_key: offerSourceKey({ sessionId, sourceType: "recognition", recognitionId: item.recognitionId }),
      });
    }
  }

  let offered = 0;
  let alreadyOffered = 0;
  for (const row of rows) {
    const { error } = await supabase.from("guide_item_offers").insert(row);
    if (!error) offered += 1;
    else if (error.code === "23505") alreadyOffered += 1;
    else return { ok: false, error: "Could not make the offer. Please try again." };
  }
  return { ok: true, offered, alreadyOffered };
}

export async function withdrawOffer(supabase: SupabaseClient, offerId: string): Promise<Result> {
  const { error } = await supabase.from("guide_item_offers").delete().eq("id", offerId);
  return error ? { ok: false, error: "Could not withdraw that offer." } : { ok: true };
}

/** For the Guide's own screen: which items they already have waiting (identity only, and
 *  only for offers still waiting; what the Host decided is never visible). */
export async function waitingOfferKeys(supabase: SupabaseClient, guideId: string, participantId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("guide_item_offers").select("id, source_key, state").eq("guide_id", guideId).eq("participant_id", participantId);
  const out = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; source_key: string; state: OfferState }[]) if (guideMayWithdraw(r.state)) out.set(r.source_key, r.id);
  return out;
}

// ---------------------------------------------------------------------------
// The Host's side: confirm, see, keep or decline (service role, after re-verifying the Host)
// ---------------------------------------------------------------------------

type Admin = ReturnType<typeof createAdminClient>;

type OfferRow = {
  id: string;
  guide_id: string;
  participant_id: string;
  session_id: string;
  source_type: "referral_field" | "recognition";
  field: string | null;
  item_index: number | null;
  recognition_id: string | null;
  label: string;
  state: OfferState;
  host_confirmed_by: string | null;
};

type ParticipantRow = { id: string; email: string | null; linked_host_id: string | null };
type SessionRow = { id: string; tool: string; conversation_id: string | null; participant_id: string | null; guide_id: string; created_at: string };

export type OfferedItem = { offerId: string; label: string; state: OfferState; text: string | null };
export type OfferGroup = {
  sessionId: string;
  participantId: string;
  guideName: string;
  sessionDate: string;
  toolName: string;
  /** True once this Host has confirmed the session is theirs; only then is any text present. */
  confirmed: boolean;
  items: OfferedItem[];
};

export function hostIdentityFrom(user: { id: string; email?: string | null; email_confirmed_at?: string | null }): HostIdentity {
  return { id: user.id, email: user.email ?? null, emailVerified: !!user.email_confirmed_at };
}

/** Resolves one offered item's text from the stored record, checking the pointer really
 *  belongs to the session the offer names. Returns null if it no longer resolves. */
async function resolveOfferText(admin: Admin, offer: OfferRow, session: SessionRow): Promise<string | null> {
  if (!session.conversation_id || session.id !== offer.session_id) return null;
  if (offer.source_type === "referral_field") {
    if (offer.field === null || offer.item_index === null) return null;
    const { data } = await admin.from("referrals").select("content").eq("conversation_id", session.conversation_id).maybeSingle();
    return referralItemText((data as { content?: unknown } | null)?.content, offer.field, offer.item_index);
  }
  if (!offer.recognition_id) return null;
  const { data } = await admin.from("recognitions").select("title, who_became_visible, conversation_id").eq("id", offer.recognition_id).maybeSingle();
  const r = data as { title: string; who_became_visible: string; conversation_id: string | null } | null;
  if (!r || r.conversation_id !== session.conversation_id) return null;
  return recognitionKeptText(r);
}

async function participantsHostMayClaim(admin: Admin, host: HostIdentity): Promise<ParticipantRow[]> {
  if (!host.emailVerified) return [];
  const seen = new Map<string, ParticipantRow>();
  const { data: linked } = await admin.from("guide_participants").select("id, email, linked_host_id").eq("linked_host_id", host.id);
  for (const p of (linked ?? []) as ParticipantRow[]) seen.set(p.id, p);
  const email = (host.email ?? "").trim();
  if (email) {
    const escaped = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: byEmail } = await admin.from("guide_participants").select("id, email, linked_host_id").is("linked_host_id", null).ilike("email", escaped);
    for (const p of (byEmail ?? []) as ParticipantRow[]) seen.set(p.id, p);
  }
  return [...seen.values()].filter((p) => hostMayConfirmParticipant(p, host));
}

/** What is waiting for this Host from Guides. Before the Host confirms a session is theirs, a
 *  group carries only metadata (the Guide's name, the date, the kind of session, and the
 *  labels of what is offered). Text appears only inside a group this Host has confirmed. */
export async function listOfferGroupsForHost(host: HostIdentity): Promise<OfferGroup[]> {
  const admin = createAdminClient();
  const participants = await participantsHostMayClaim(admin, host);
  if (participants.length === 0) return [];
  const { data: offerRows } = await admin
    .from("guide_item_offers")
    .select("id, guide_id, participant_id, session_id, source_type, field, item_index, recognition_id, label, state, host_confirmed_by")
    .in("participant_id", participants.map((p) => p.id))
    .in("state", ["offered", "confirmed"])
    .order("created_at", { ascending: true });
  const offers = (offerRows ?? []) as OfferRow[];
  if (offers.length === 0) return [];

  const sessionIds = [...new Set(offers.map((o) => o.session_id))];
  const { data: sessionRows } = await admin.from("guide_sessions").select("id, tool, conversation_id, participant_id, guide_id, created_at").in("id", sessionIds);
  const sessions = new Map(((sessionRows ?? []) as SessionRow[]).map((s) => [s.id, s]));
  const guideIds = [...new Set(offers.map((o) => o.guide_id))];
  const { data: guideRows } = await admin.from("profiles").select("id, guide_display_name").in("id", guideIds);
  const guideName = new Map(((guideRows ?? []) as { id: string; guide_display_name: string | null }[]).map((g) => [g.id, g.guide_display_name?.trim() || "a Guide"]));

  const groups = new Map<string, OfferGroup>();
  for (const offer of offers) {
    const session = sessions.get(offer.session_id);
    if (!session) continue;
    let group = groups.get(offer.session_id);
    if (!group) {
      group = {
        sessionId: offer.session_id,
        participantId: offer.participant_id,
        guideName: guideName.get(offer.guide_id) ?? "a Guide",
        sessionDate: session.created_at,
        toolName: toolLabel(session.tool as Parameters<typeof toolLabel>[0]),
        confirmed: false,
        items: [],
      };
      groups.set(offer.session_id, group);
    }
    const mayRead = hostMaySeeOfferedItem(offer, host.id);
    if (mayRead) group.confirmed = true;
    group.items.push({
      offerId: offer.id,
      label: offer.label,
      state: offer.state,
      text: mayRead ? await resolveOfferText(admin, offer, session) : null,
    });
  }
  // Within one session, a group counts as confirmed only if every waiting item was confirmed.
  for (const g of groups.values()) g.confirmed = g.items.length > 0 && g.items.every((i) => i.state === "confirmed");
  return [...groups.values()].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}

async function participantForSession(admin: Admin, sessionId: string): Promise<{ session: SessionRow; participant: ParticipantRow } | null> {
  const { data: s } = await admin.from("guide_sessions").select("id, tool, conversation_id, participant_id, guide_id, created_at").eq("id", sessionId).maybeSingle();
  const session = s as SessionRow | null;
  if (!session?.participant_id) return null;
  const { data: p } = await admin.from("guide_participants").select("id, email, linked_host_id").eq("id", session.participant_id).maybeSingle();
  return p ? { session, participant: p as ParticipantRow } : null;
}

/** Step 1: the Host says "this session was mine." Re-verifies the Host against the
 *  participant, claims the participant connection if it was not yet linked, and only then
 *  marks the waiting offers confirmed. */
export async function confirmSession(host: HostIdentity, sessionId: string): Promise<Result> {
  const admin = createAdminClient();
  const found = await participantForSession(admin, sessionId);
  if (!found || !hostMayConfirmParticipant(found.participant, host)) return { ok: false, error: "This could not be matched to you." };
  if (!found.participant.linked_host_id) {
    const { error } = await admin.from("guide_participants").update({ linked_host_id: host.id }).eq("id", found.participant.id).is("linked_host_id", null);
    if (error) return { ok: false, error: "Could not confirm this. Please try again." };
  }
  const now = new Date().toISOString();
  const { error } = await admin
    .from("guide_item_offers")
    .update({ state: "confirmed", host_confirmed_by: host.id, host_confirmed_at: now })
    .eq("session_id", sessionId)
    .eq("participant_id", found.participant.id)
    .eq("state", "offered");
  return error ? { ok: false, error: "Could not confirm this. Please try again." } : { ok: true };
}

/** "This was not my session", or the Host simply does not want any of it: every waiting offer
 *  from that session is declined and drops out of the Guide's sight. Nothing is kept. */
export async function declineSession(host: HostIdentity, sessionId: string): Promise<Result> {
  const admin = createAdminClient();
  const found = await participantForSession(admin, sessionId);
  if (!found || !hostMayConfirmParticipant(found.participant, host)) return { ok: false, error: "This could not be matched to you." };
  const { error } = await admin
    .from("guide_item_offers")
    .update({ state: "declined", decided_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("participant_id", found.participant.id)
    .in("state", ["offered", "confirmed"]);
  return error ? { ok: false, error: "Could not update that." } : { ok: true };
}

async function loadOffer(admin: Admin, offerId: string): Promise<{ offer: OfferRow; session: SessionRow; participant: ParticipantRow } | null> {
  const { data } = await admin
    .from("guide_item_offers")
    .select("id, guide_id, participant_id, session_id, source_type, field, item_index, recognition_id, label, state, host_confirmed_by")
    .eq("id", offerId)
    .maybeSingle();
  const offer = data as OfferRow | null;
  if (!offer) return null;
  const found = await participantForSession(admin, offer.session_id);
  if (!found || found.participant.id !== offer.participant_id) return null;
  return { offer, session: found.session, participant: found.participant };
}

/** Step 3: the Host chooses "Keep this" on an item they have seen. Only this creates the
 *  Host-owned kept item. Re-verifies the Host and the confirmation; resolves the text from
 *  the stored record (never from the browser); records the Guide only as provenance. */
export async function keepOffer(host: HostIdentity, offerId: string): Promise<Result> {
  const admin = createAdminClient();
  const loaded = await loadOffer(admin, offerId);
  if (!loaded) return { ok: false, error: "That offer could not be found." };
  const { offer, session, participant } = loaded;
  if (!hostMayConfirmParticipant(participant, host) || !hostMayKeepOffer(offer, host.id)) {
    return { ok: false, error: "Confirm that this session was yours first." };
  }
  const text = await resolveOfferText(admin, offer, session);
  if (!text) return { ok: false, error: "That item is no longer available." };

  const { data: guide } = await admin.from("profiles").select("guide_display_name").eq("id", offer.guide_id).maybeSingle();
  const guideName = (guide as { guide_display_name: string | null } | null)?.guide_display_name?.trim() || null;
  const kind: KeptKind = offer.source_type === "recognition" ? "recognition" : "host_voice";
  const written = await writeKept(admin, {
    host_id: host.id,
    kind,
    label: offer.label,
    content: text,
    source_type: "guide_offer",
    source_reference: session.conversation_id ?? session.id,
    source_key: keptSourceKey({ sourceType: "guide_offer", sourceReference: offerKeyOf(offer) }),
    from_guide_id: offer.guide_id,
    from_guide_name: guideName,
    from_session_date: session.created_at,
  });
  if (!written.ok) return written;
  await admin.from("guide_item_offers").update({ state: "kept", decided_at: new Date().toISOString() }).eq("id", offer.id);
  return { ok: true };
}

function offerKeyOf(offer: OfferRow): string {
  return offerSourceKey({
    sessionId: offer.session_id,
    sourceType: offer.source_type,
    field: offer.field,
    index: offer.item_index,
    recognitionId: offer.recognition_id,
  });
}

/** The Host chooses "Decline" on one item. Nothing is kept; it leaves the Guide's sight. */
export async function declineOffer(host: HostIdentity, offerId: string): Promise<Result> {
  const admin = createAdminClient();
  const loaded = await loadOffer(admin, offerId);
  if (!loaded || !hostMayConfirmParticipant(loaded.participant, host)) return { ok: false, error: "That offer could not be found." };
  const { error } = await admin
    .from("guide_item_offers")
    .update({ state: "declined", decided_at: new Date().toISOString() })
    .eq("id", offerId)
    .in("state", ["offered", "confirmed"]);
  return error ? { ok: false, error: "Could not update that." } : { ok: true };
}

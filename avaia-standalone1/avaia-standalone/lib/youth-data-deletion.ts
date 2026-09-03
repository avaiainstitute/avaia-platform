import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// AVAIA Youth data retention/deletion. COPPA (researched via ftc.gov/
// business-guidance/resources/complying-coppa-frequently-asked-questions):
// operators must retain a child's personal information "for only as long
// as is necessary to fulfill the purpose for which it was collected and
// delete the information using reasonable measures." This module is the
// technical capability that requires -- it does not decide, and does not
// invent, the retention PERIOD (a policy/legal decision AVAIA has not yet
// made); it makes deletion something an admin can actually do, on demand,
// right now, for any Youth-linked record.
//
// Youth-linked data map (every table touched, and why):
// - guide_participants: the person record itself.
// - guide_sessions: which tools/conversations this participant used.
// - conversations / messages / referrals: the IAP/CAT/InnerCompass
//   Journey engine's own tables, reached via guide_sessions.conversation_id
//   for tool in (iap, cat, innercompass).
// - journeys: the Journey container, reached via conversations.journey_id.
// - unsung_heroes_conversations / unsung_heroes_messages / recognitions:
//   reached via guide_sessions.conversation_id for tool = 'unsung-heroes'.
// - guardian_consents: reached via guide_participant_id.
// - youth_program_participants: this participant's program registrations.
// - crisis_events: reached via guide_participant_id (manual flags) --
//   automated keyword-backstop rows only carry conversation_id, covered
//   by the conversation-id-based delete below.
//
// Self-serve Youth Host data map (profiles-based, not
// guide_participants-based): conversations/messages/referrals/journeys
// where host_id = X and program = 'youth' specifically -- NOT every
// conversation this account ever had, since a Host may hold both adult
// and Youth Journeys over time (e.g. after turning 18) and this is a
// scoped "erase the Youth-linked record," not full account deletion
// (a separate, larger action this does not perform). Also their
// guardian_consents rows and their profiles.developmental_band.

export type DeletionCounts = Record<string, number>;

/** Deletes every record linked to one Guide-facilitated Youth participant.
 *  `supabase` should be an admin (service-role) client -- this crosses
 *  ownership boundaries by design (an admin acting on a Guide's
 *  participant data), which RLS would otherwise correctly block. Callers
 *  must independently verify admin authorization before calling this --
 *  see app/admin/youth-data's own re-check, matching the established
 *  admin-action pattern (grantGuideCertification et al. never trust the
 *  page's own gate alone). */
export async function deleteYouthParticipantData(
  supabase: SupabaseClient,
  participantId: string
): Promise<DeletionCounts> {
  const counts: DeletionCounts = {};

  const { data: sessions } = await supabase
    .from("guide_sessions")
    .select("id, tool, conversation_id")
    .eq("participant_id", participantId);

  const journeyToolIds = (sessions ?? [])
    .filter((s) => ["iap", "cat", "innercompass"].includes(s.tool) && s.conversation_id)
    .map((s) => s.conversation_id as string);
  const uhIds = (sessions ?? [])
    .filter((s) => s.tool === "unsung-heroes" && s.conversation_id)
    .map((s) => s.conversation_id as string);

  let journeyIds: string[] = [];
  if (journeyToolIds.length) {
    const { data: convos } = await supabase.from("conversations").select("id, journey_id").in("id", journeyToolIds);
    journeyIds = (convos ?? []).map((c) => c.journey_id).filter((j): j is string => !!j);

    const { count: msgCount } = await supabase
      .from("messages")
      .delete({ count: "exact" })
      .in("conversation_id", journeyToolIds);
    counts.messages = msgCount ?? 0;

    const { count: refCount } = await supabase
      .from("referrals")
      .delete({ count: "exact" })
      .in("conversation_id", journeyToolIds);
    counts.referrals = refCount ?? 0;

    const { count: convoCount } = await supabase
      .from("conversations")
      .delete({ count: "exact" })
      .in("id", journeyToolIds);
    counts.conversations = convoCount ?? 0;
  }

  if (journeyIds.length) {
    const { count: journeyCount } = await supabase.from("journeys").delete({ count: "exact" }).in("id", journeyIds);
    counts.journeys = journeyCount ?? 0;
  }

  if (uhIds.length) {
    const { count: uhMsgCount } = await supabase
      .from("unsung_heroes_messages")
      .delete({ count: "exact" })
      .in("conversation_id", uhIds);
    counts.unsung_heroes_messages = uhMsgCount ?? 0;

    const { count: recCount } = await supabase
      .from("recognitions")
      .delete({ count: "exact" })
      .in("conversation_id", uhIds);
    counts.recognitions = recCount ?? 0;

    const { count: uhConvoCount } = await supabase
      .from("unsung_heroes_conversations")
      .delete({ count: "exact" })
      .in("id", uhIds);
    counts.unsung_heroes_conversations = uhConvoCount ?? 0;
  }

  const { count: gcCount } = await supabase
    .from("guardian_consents")
    .delete({ count: "exact" })
    .eq("guide_participant_id", participantId);
  counts.guardian_consents = gcCount ?? 0;

  const { count: programCount } = await supabase
    .from("youth_program_participants")
    .delete({ count: "exact" })
    .eq("participant_id", participantId);
  counts.youth_program_participants = programCount ?? 0;

  const { count: crisisCount } = await supabase
    .from("crisis_events")
    .delete({ count: "exact" })
    .eq("guide_participant_id", participantId);
  counts.crisis_events = crisisCount ?? 0;

  const { count: sessionCount } = await supabase
    .from("guide_sessions")
    .delete({ count: "exact" })
    .eq("participant_id", participantId);
  counts.guide_sessions = sessionCount ?? 0;

  const { count: participantCount } = await supabase
    .from("guide_participants")
    .delete({ count: "exact" })
    .eq("id", participantId);
  counts.guide_participants = participantCount ?? 0;

  return counts;
}

/** Deletes the Youth-linked record for a self-serve Youth Host --
 *  program='youth' conversations/messages/referrals/journeys and their
 *  guardian_consents rows, plus clearing profiles.developmental_band.
 *  Does NOT delete the account/profile itself or any non-Youth
 *  (program != 'youth') data -- this is a scoped erasure of the
 *  Youth-linked record, not full account deletion. `supabase` should be
 *  an admin (service-role) client. */
export async function deleteYouthHostData(supabase: SupabaseClient, hostId: string): Promise<DeletionCounts> {
  const counts: DeletionCounts = {};

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, journey_id")
    .eq("host_id", hostId)
    .eq("program", "youth");
  const conversationIds = (convos ?? []).map((c) => c.id);
  const journeyIds = (convos ?? []).map((c) => c.journey_id).filter((j): j is string => !!j);

  if (conversationIds.length) {
    const { count: msgCount } = await supabase
      .from("messages")
      .delete({ count: "exact" })
      .in("conversation_id", conversationIds);
    counts.messages = msgCount ?? 0;

    const { count: refCount } = await supabase
      .from("referrals")
      .delete({ count: "exact" })
      .in("conversation_id", conversationIds);
    counts.referrals = refCount ?? 0;

    const { count: convoCount } = await supabase
      .from("conversations")
      .delete({ count: "exact" })
      .in("id", conversationIds);
    counts.conversations = convoCount ?? 0;
  }

  if (journeyIds.length) {
    const { count: journeyCount } = await supabase.from("journeys").delete({ count: "exact" }).in("id", journeyIds);
    counts.journeys = journeyCount ?? 0;
  }

  const { count: gcCount } = await supabase
    .from("guardian_consents")
    .delete({ count: "exact" })
    .eq("youth_host_id", hostId);
  counts.guardian_consents = gcCount ?? 0;

  // Unlike deleteYouthParticipantData above, this path never deletes the
  // account/profile row itself, so virtue_signature_entries' ON DELETE
  // CASCADE on host_id never fires here -- found during the admin/Guide
  // usability pass: entries from a deleted Youth conversation were being
  // silently left behind. Scoped to entries whose source_reference is one
  // of the Youth conversations just deleted above, since a Signature entry
  // carries no program tag of its own and a manually self-added entry
  // (source_type 'self', no conversation_id) can't be attributed to Youth
  // vs. adult use of the same account.
  if (conversationIds.length) {
    const { count: sigCount } = await supabase
      .from("virtue_signature_entries")
      .delete({ count: "exact" })
      .eq("host_id", hostId)
      .in("source_reference", conversationIds);
    counts.virtue_signature_entries = sigCount ?? 0;
  }

  await supabase.from("profiles").update({ developmental_band: null }).eq("id", hostId);

  return counts;
}

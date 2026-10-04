// KEEP THIS: the rules that let a Host intentionally carry something from an AVAIA
// experience into their own continuing record (Move 7).
//
// The governing distinction, enforced here and in the database:
//   A Guide may OFFER something back to the Host for consideration.
//   A Guide may never decide that something belongs in the Host's record.
// For an item that came through a Guide-run session, the Host must
//   1. confirm the session is theirs,  2. see the item,  3. choose "Keep this".
// Only that Host action creates a kept item. Nothing private is ever kept
// automatically, and AI never decides what is worth keeping.
//
// Pure rules only (no I/O), so the System Checks self-test runs the very same
// functions production uses.

/** The Host's own words and chosen direction, as the Workbook already labels them
 *  ("In your own words"). Only these referral fields may be offered or kept: they are
 *  Host-authored or Host-voiced, never a stage's own synthesis. */
export const HOST_VOICE_FIELDS = [
  "anchorStatements",
  "reflectionsThatEmerged",
  "questionsWorthCarrying",
  "decisionsMade",
  "commitmentsChosen",
] as const;
export type HostVoiceField = (typeof HOST_VOICE_FIELDS)[number];

export const HOST_VOICE_LABEL: Record<HostVoiceField, string> = {
  anchorStatements: "Anchor statement",
  reflectionsThatEmerged: "Reflection that emerged",
  questionsWorthCarrying: "Question worth carrying",
  decisionsMade: "Decision made",
  commitmentsChosen: "Commitment chosen",
};

export function isOfferableField(field: string): field is HostVoiceField {
  return (HOST_VOICE_FIELDS as readonly string[]).includes(field);
}

export const KEPT_KINDS = ["host_voice", "recognition"] as const;
export type KeptKind = (typeof KEPT_KINDS)[number];

export const KEPT_SOURCE_TYPES = ["journey_conversation", "unsung_heroes_recognition", "guide_offer"] as const;
export type KeptSourceType = (typeof KEPT_SOURCE_TYPES)[number];

export const OFFER_SOURCE_TYPES = ["referral_field", "recognition"] as const;
export type OfferSourceType = (typeof OFFER_SOURCE_TYPES)[number];

/** Offer states. The Guide only ever creates 'offered'. 'confirmed' is the Host saying the
 *  session is theirs. 'kept' and 'declined' are the Host's own choices; the Guide never
 *  sees them (the Guide can only see an offer that is still waiting). */
export const OFFER_STATES = ["offered", "confirmed", "kept", "declined"] as const;
export type OfferState = (typeof OFFER_STATES)[number];

/** One stable identity per kept thing, so keeping it twice is the same item, not two. */
export function keptSourceKey(args: { sourceType: KeptSourceType; sourceReference: string; field?: string | null; index?: number | null }): string {
  return [args.sourceType, args.sourceReference, args.field ?? "", args.index ?? ""].join(":");
}

export function offerSourceKey(args: { sessionId: string; sourceType: OfferSourceType; field?: string | null; index?: number | null; recognitionId?: string | null }): string {
  return [args.sessionId, args.sourceType, args.field ?? "", args.index ?? "", args.recognitionId ?? ""].join(":");
}

export type ParticipantIdentity = { linked_host_id: string | null; email: string | null };
export type HostIdentity = { id: string; email: string | null | undefined; emailVerified: boolean };

const normalizeEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** Whether a Guide's record of a participant could belong to this signed-in Host, which is
 *  only a reason to show them the question, never a reason to show them the item. The person
 *  must have a VERIFIED email; then the participant is theirs to claim if it is already linked
 *  to them, or if it is not linked to anyone and the Guide-recorded email is theirs. A participant
 *  linked to a different account is never theirs. */
export function hostMayConfirmParticipant(participant: ParticipantIdentity, host: HostIdentity): boolean {
  if (!host.emailVerified) return false;
  if (participant.linked_host_id) return participant.linked_host_id === host.id;
  const a = normalizeEmail(participant.email);
  return a.length > 0 && a === normalizeEmail(host.email);
}

/** A Guide can offer only to someone the system could actually reach: a participant already
 *  linked to an account, or one with an email a later account could match. */
export function participantIsReachable(participant: ParticipantIdentity): boolean {
  return !!participant.linked_host_id || normalizeEmail(participant.email).length > 0;
}

/** The Host sees an item only after confirming the session is theirs. Metadata comes first. */
export function hostMaySeeOfferedItem(offer: { state: OfferState; host_confirmed_by: string | null }, hostId: string): boolean {
  return offer.state === "confirmed" && offer.host_confirmed_by === hostId;
}

/** Keep is a Host action on a confirmed offer, nothing else. */
export function hostMayKeepOffer(offer: { state: OfferState; host_confirmed_by: string | null }, hostId: string): boolean {
  return hostMaySeeOfferedItem(offer, hostId);
}

/** A Guide can take back an offer that is still waiting; once the Host has answered it is out
 *  of the Guide's hands (and out of the Guide's sight). */
export function guideMayWithdraw(state: OfferState): boolean {
  return state === "offered" || state === "confirmed";
}

/** What the Guide is allowed to know about an offer: only that it is still waiting. */
export function guideSeesOffer(state: OfferState): boolean {
  return state === "offered" || state === "confirmed";
}

/** Reads one string out of a referral's content by field and position, or null. The text is
 *  always resolved from the stored record on the server, never taken from a client. */
export function referralItemText(content: unknown, field: string, index: number): string | null {
  if (!isOfferableField(field)) return null;
  if (!content || typeof content !== "object") return null;
  const value = (content as Record<string, unknown>)[field];
  if (!Array.isArray(value)) return null;
  const item = value[index];
  return typeof item === "string" && item.trim() ? item.trim() : null;
}

/** The Host-voiced items a referral holds, with the position each one is addressed by. */
export function hostVoiceItems(content: unknown): { field: HostVoiceField; index: number; text: string }[] {
  const out: { field: HostVoiceField; index: number; text: string }[] = [];
  if (!content || typeof content !== "object") return out;
  for (const field of HOST_VOICE_FIELDS) {
    const value = (content as Record<string, unknown>)[field];
    if (!Array.isArray(value)) continue;
    value.forEach((item, index) => {
      if (typeof item === "string" && item.trim()) out.push({ field, index, text: item.trim() });
    });
  }
  return out;
}

/** The text a kept recognition carries: the title and who became visible. */
export function recognitionKeptText(r: { title: string; who_became_visible: string }): string {
  return `${r.title}\n\n${r.who_became_visible}`.trim();
}

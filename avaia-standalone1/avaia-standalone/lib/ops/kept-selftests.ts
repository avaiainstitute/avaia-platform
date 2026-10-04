import "server-only";
import {
  HOST_VOICE_FIELDS,
  guideMayWithdraw,
  guideSeesOffer,
  hostMayConfirmParticipant,
  hostMayKeepOffer,
  hostMaySeeOfferedItem,
  hostVoiceItems,
  isOfferableField,
  keptSourceKey,
  offerSourceKey,
  participantIsReachable,
  recognitionKeptText,
  referralItemText,
  type OfferState,
} from "@/lib/kept-items";
import * as virtueSignature from "@/lib/virtue-signature";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR "KEEP THIS" (Move 7). Simulated records only: nothing is read from or
// written to the database. They run the very same rules production runs, so if a future
// change quietly breaks one of these promises the next System Check reports it:
//
//   * a Guide may OFFER, never decide: an offer reveals only metadata until the Host confirms
//     the session is theirs; only a Host who confirmed can see or keep an item;
//   * only Host-authored fields can be offered or kept (never a stage's own synthesis);
//   * the Host is matched to a participant only through a VERIFIED email (or an existing link
//     to them), and never to a participant linked to someone else;
//   * the Guide never learns what the Host decided;
//   * there is no code path left that lets a Guide write into a participant's Virtue Signature.
//
// The database half of the promise (no Guide, admin or operational policy on kept items;
// an offer can only be created by its Guide; no update policy for a Guide) is proven against
// the live catalog by schema_rules in lib/ops/system-truth.ts.

type Case = { name: string; ok: boolean };

function result(key: string, label: string, passDetail: string, cases: Case[]): CheckResult {
  const failed = cases.filter((c) => !c.ok).map((c) => c.name);
  return failed.length === 0
    ? { category: "quality", checkKey: key, label, status: "pass", detail: passDetail }
    : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
}

function keepThisCheck(): CheckResult {
  const key = "pipeline_keep_this";
  const label = "Keep this behaves as designed";
  try {
    const cases: Case[] = [];
    const me = { id: "host-1", email: "Dana@Example.com", emailVerified: true };

    // Only the Host's own words can be offered or kept.
    cases.push({ name: "the offerable fields are not exactly the five Host-voiced ones", ok: HOST_VOICE_FIELDS.length === 5 && HOST_VOICE_FIELDS.every((f) => isOfferableField(f)) });
    for (const synthesis of ["hostOverview", "currentConcern", "primaryThreads", "internalTensions", "governingNarratives", "listeningCues", "boundariesToProtect"]) {
      cases.push({ name: `a stage's own synthesis (${synthesis}) was offerable`, ok: !isOfferableField(synthesis) });
    }
    const content = { anchorStatements: ["  I am enough  ", "", 7], reflectionsThatEmerged: ["It was never about the house"], hostOverview: ["synthesis"] };
    cases.push({ name: "an item was not resolved by field and position", ok: referralItemText(content, "anchorStatements", 0) === "I am enough" });
    cases.push({ name: "an empty or non-text item resolved", ok: referralItemText(content, "anchorStatements", 1) === null && referralItemText(content, "anchorStatements", 2) === null });
    cases.push({ name: "an out-of-range position resolved", ok: referralItemText(content, "reflectionsThatEmerged", 5) === null });
    cases.push({ name: "a non-Host-voice field resolved", ok: referralItemText(content, "hostOverview", 0) === null });
    cases.push({ name: "a missing referral resolved", ok: referralItemText(null, "anchorStatements", 0) === null });
    const listed = hostVoiceItems(content);
    cases.push({ name: "Host-voice items were not listed by field and position", ok: listed.length === 2 && listed[0].field === "anchorStatements" && listed[0].index === 0 && listed[1].field === "reflectionsThatEmerged" });
    cases.push({ name: "a kept recognition lost its title or who became visible", ok: recognitionKeptText({ title: "T", who_became_visible: "W" }) === "T\n\nW" });

    // The Host is matched only through a verified email, or an existing link to them.
    cases.push({ name: "a verified email matching an unlinked participant was refused", ok: hostMayConfirmParticipant({ linked_host_id: null, email: "dana@example.com" }, me) });
    cases.push({ name: "an unverified email was matched to a participant", ok: !hostMayConfirmParticipant({ linked_host_id: null, email: "dana@example.com" }, { ...me, emailVerified: false }) });
    cases.push({ name: "a different email was matched", ok: !hostMayConfirmParticipant({ linked_host_id: null, email: "someone@example.com" }, me) });
    cases.push({ name: "a participant with no email was matched", ok: !hostMayConfirmParticipant({ linked_host_id: null, email: null }, me) });
    cases.push({ name: "a participant linked to someone else was matched on email", ok: !hostMayConfirmParticipant({ linked_host_id: "host-2", email: "dana@example.com" }, me) });
    cases.push({ name: "a participant already linked to this Host was refused", ok: hostMayConfirmParticipant({ linked_host_id: "host-1", email: null }, me) });
    cases.push({ name: "an unverified Host was matched through an existing link", ok: !hostMayConfirmParticipant({ linked_host_id: "host-1", email: null }, { ...me, emailVerified: false }) });
    cases.push({ name: "a participant with neither a link nor an email was reachable", ok: !participantIsReachable({ linked_host_id: null, email: " " }) && participantIsReachable({ linked_host_id: null, email: "a@b.c" }) && participantIsReachable({ linked_host_id: "h", email: null }) });

    // Metadata first; the item only after the Host confirms; Keep only after that.
    const state = (s: OfferState, by: string | null = null) => ({ state: s, host_confirmed_by: by });
    cases.push({ name: "an item was visible before the Host confirmed the session", ok: !hostMaySeeOfferedItem(state("offered"), me.id) });
    cases.push({ name: "an item was visible after the Host confirmed it", ok: hostMaySeeOfferedItem(state("confirmed", me.id), me.id) });
    cases.push({ name: "an item confirmed by someone else was visible to this Host", ok: !hostMaySeeOfferedItem(state("confirmed", "host-2"), me.id) });
    cases.push({ name: "a declined or kept offer could be seen again", ok: !hostMaySeeOfferedItem(state("declined", me.id), me.id) && !hostMaySeeOfferedItem(state("kept", me.id), me.id) });
    cases.push({ name: "an unconfirmed offer could be kept", ok: !hostMayKeepOffer(state("offered"), me.id) && !hostMayKeepOffer(state("offered", me.id), me.id) });
    cases.push({ name: "a confirmed offer could not be kept by the Host who confirmed it", ok: hostMayKeepOffer(state("confirmed", me.id), me.id) });
    cases.push({ name: "another Host could keep an offer they did not confirm", ok: !hostMayKeepOffer(state("confirmed", "host-2"), me.id) });

    // The Guide offers and withdraws; it never learns the decision.
    cases.push({ name: "a Guide could not withdraw a waiting offer", ok: guideMayWithdraw("offered") && guideMayWithdraw("confirmed") });
    cases.push({ name: "a Guide could withdraw an offer the Host had already decided", ok: !guideMayWithdraw("kept") && !guideMayWithdraw("declined") });
    cases.push({ name: "a Guide could see what the Host decided", ok: guideSeesOffer("offered") && guideSeesOffer("confirmed") && !guideSeesOffer("kept") && !guideSeesOffer("declined") });

    // Identity: the same item is the same item.
    cases.push({ name: "two different items shared a kept identity", ok: keptSourceKey({ sourceType: "journey_conversation", sourceReference: "c1", field: "anchorStatements", index: 0 }) !== keptSourceKey({ sourceType: "journey_conversation", sourceReference: "c1", field: "anchorStatements", index: 1 }) });
    cases.push({ name: "the same item had two kept identities", ok: keptSourceKey({ sourceType: "unsung_heroes_recognition", sourceReference: "r1" }) === keptSourceKey({ sourceType: "unsung_heroes_recognition", sourceReference: "r1" }) });
    cases.push({ name: "two different offers shared an identity", ok: offerSourceKey({ sessionId: "s1", sourceType: "referral_field", field: "decisionsMade", index: 0 }) !== offerSourceKey({ sessionId: "s1", sourceType: "referral_field", field: "decisionsMade", index: 1 }) && offerSourceKey({ sessionId: "s1", sourceType: "recognition", recognitionId: "r1" }) !== offerSourceKey({ sessionId: "s2", sourceType: "recognition", recognitionId: "r1" }) });

    // No competing path: a Guide has no way to write a participant's Virtue Signature.
    cases.push({ name: "a function that writes a participant's Virtue Signature still exists", ok: !("addSignatureEntryForParticipant" in virtueSignature) });

    return result(
      key,
      label,
      "Simulated records confirm: only Host-authored fields can be offered or kept; an offer shows only metadata until the Host confirms the session is theirs, then the Host alone can see and keep it; the Host is matched only through a verified email or an existing link to them, never to a participant linked to someone else; the Guide can withdraw a waiting offer but never sees what the Host decided; and no code path remains for a Guide to write a participant's Virtue Signature.",
      cases
    );
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function keepThisChecks(): CheckResult[] {
  return [keepThisCheck()];
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DevelopmentalBand } from "./engine/prompts";

// AVAIA Youth Defying Grief -- Guardian Consent + Youth Privacy & Agency.
// Governing model: "The guardian gives permission for participation. The
// Youth Host retains ownership of their story and agency over what they
// choose to share." This module owns exactly two things: the disclosure
// text a guardian is shown before consenting, and the age-banded assent
// text a Youth Host is shown before participating. It has no relationship
// to content access -- RLS on conversations, messages, referrals, and
// recognitions already scopes those to the Host (or the Guide's own
// guide_sessions ownership) alone, entirely unchanged by this module.

export type GuardianConsentScope = "individual" | "group_workshop" | "school_organization";

export type GuardianConsent = {
  id: string;
  youth_host_id: string | null;
  guide_participant_id: string | null;
  scope: GuardianConsentScope;
  guardian_name: string;
  guardian_email: string;
  relationship: string | null;
  sponsoring_organization: string | null;
  disclosure_text: string;
  recorded_by: string | null;
  consented_at: string;
  status: "active" | "revoked";
  revoked_at: string | null;
  created_at: string;
};

// Versioned the same way lib/safety.ts's DISCLAIMER_VERSION already is --
// bump this if the substance of what a guardian is told ever changes.
// disclosure_text on each row is a permanent snapshot regardless, so a
// version bump here never rewrites what a past guardian actually saw.
export const GUARDIAN_DISCLOSURE_VERSION = "youth-guardian-2026-09";

/** Shown to a guardian (or read to them by a Guide) before they consent.
 *  Covers, per AVAIA's governing decision: what AVAIA / Youth Defying
 *  Grief is, its nature and purpose, who facilitates it, what
 *  participation generally involves, privacy/safeguarding boundaries, and
 *  what the guardian will and will not have access to. */
export const GUARDIAN_DISCLOSURE_TEXT = `AVAIA is a guided, virtue-centered conversation platform. Youth Defying Grief is an AVAIA program that helps young people (ages 8-17) recognize and understand a loss or disruption in their life -- not limited to death, but also divorce, a move, a friendship ending, or another significant change. It is not therapy, counseling, or crisis care.

Participation is facilitated by an AVAIA-certified Guide, either one-on-one or, where offered, as part of a small group session, and may include a private, individual AVAIA conversation (Individual Awareness Profile, Conversations Across Time, and InnerCompass) that only your child can access.

Your child owns their own story. Guardian consent authorizes their participation -- it does not give you, a school, or any organization access to what your child says privately to their Guide or to AVAIA. Your child decides what, if anything, they choose to share with you afterward.

If a genuine safety concern arises -- such as a risk of harm -- AVAIA and the Guide will act on it the same way any responsible adult would, which may include involving you or another trusted adult. Short of that narrow exception, your child's private reflections remain private.

You may withdraw this consent at any time by contacting the Guide or AVAIA directly.`;

/** Shown to (or read with) the Youth Host themselves, at their own
 *  developmental register -- a separate thing from guardian consent.
 *  Guardian consent authorizes participation; this is the Youth Host's
 *  own understanding of what that participation actually involves,
 *  what's private, what's shared, and what choices remain theirs. Written
 *  to each band's actual reading level, not a single document with a
 *  reading-level disclaimer -- the youngest band should never need to
 *  parse adult privacy language to understand it. */
export const YOUTH_ASSENT_TEXT: Record<DevelopmentalBand, string> = {
  "8-11": `Here's what's happening: You get to talk with a caring adult (called a Guide) about things that have changed in your life. This is not school, and it's not a test -- there's no wrong answer.

Some of what you say is just between you and your Guide. If you're with a group, you never have to say things out loud if you don't want to -- you can just think about them quietly, or write them down for yourself.

You can say "I don't want to talk about that" any time, about anything, and that's okay. You can also stop at any point.

Your grown-up said it's okay for you to be here today. But what you say stays yours -- your Guide won't tell your grown-up everything you talk about, unless something is going on that means a grown-up needs to help keep you safe.`,

  "12-14": `What this is: a space to talk honestly about something that's changed or been hard in your life, with a Guide trained to listen without judging you or trying to fix you.

What's private: anything you say in a one-on-one conversation with AVAIA stays private. It isn't automatically shared with your parent/guardian, your school, or anyone else -- not because anyone's hiding anything, but because it's yours.

What's shared: if you're in a group, some parts happen together with everyone else -- but you never have to say something out loud that you don't want to. You can keep it to yourself and just think it through privately instead.

Your choices: you can skip any question, decline any activity, or stop the whole thing at any time -- no explanation needed. Your parent/guardian already said you could be here, but that agreement doesn't give them a window into what you say privately.

One exception: if something you share points to a real safety concern, your Guide may need to involve a trusted adult -- the same as any responsible adult would do. That's narrow and specific, not a general rule.`,

  "15-17": `What this is: Youth Defying Grief is a guided space to work through a loss or disruption in your life -- your own pace, your own terms, with a certified Guide.

Privacy: what you say in a private AVAIA conversation is private. It is not shared with your parent/guardian, your school, or a sponsoring organization just because they arranged for you to participate -- consent to participate is not the same as access to your story.

Group settings: if part of this happens in a group, you're never required to disclose anything out loud. Staying quiet, reflecting privately, or simply not sharing is a complete and legitimate way to participate.

Your choices: you can decline any question or activity, and stop at any point, without needing to justify it.

The one real exception: if something you share indicates a genuine safety concern -- risk of harm to you or someone else -- your Guide may need to act on it, which could include involving another adult. That's a narrow, specific exception, not a loophole for general oversight.`,
};

/** Records a guardian consent for a self-serve Youth Host. Called from
 *  /api/consent when age === "minor" -- the same request that already
 *  sets profiles.minor_with_guardian, now also creating a real, named,
 *  contactable, revocable record instead of only a self-attested
 *  checkbox. `supabase` must be the caller's own RLS-scoped client
 *  (matches this route's existing pattern) -- RLS enforces
 *  youth_host_id/recorded_by = auth.uid() regardless. */
export async function recordGuardianConsentForYouthHost(
  supabase: SupabaseClient,
  youthHostId: string,
  guardianName: string,
  guardianEmail: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("guardian_consents").insert({
    youth_host_id: youthHostId,
    scope: "individual",
    guardian_name: guardianName,
    guardian_email: guardianEmail,
    relationship: "parent or guardian",
    disclosure_text: GUARDIAN_DISCLOSURE_TEXT,
    recorded_by: youthHostId,
  });
  return { error: error?.message ?? null };
}

/** Records a guardian consent a Guide has collected for a Guide-
 *  facilitated participant -- individual, group/workshop, or a
 *  school/organization-sponsored context. `supabase` must be the Guide's
 *  own RLS-scoped client; RLS enforces the participant belongs to this
 *  Guide and recorded_by = auth.uid(). */
export async function recordGuardianConsentForParticipant(
  supabase: SupabaseClient,
  guideId: string,
  participantId: string,
  scope: GuardianConsentScope,
  guardianName: string,
  guardianEmail: string,
  sponsoringOrganization: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("guardian_consents").insert({
    guide_participant_id: participantId,
    scope,
    guardian_name: guardianName,
    guardian_email: guardianEmail,
    relationship: scope === "school_organization" ? "sponsoring organization contact" : "parent or guardian",
    sponsoring_organization: sponsoringOrganization,
    disclosure_text: GUARDIAN_DISCLOSURE_TEXT,
    recorded_by: guideId,
  });
  return { error: error?.message ?? null };
}

/** Whether an active (non-revoked) guardian consent already exists for a
 *  Guide-facilitated participant -- lets a Guide start a second Youth
 *  session for a returning participant without re-collecting consent
 *  every time. */
export async function hasActiveGuardianConsent(
  supabase: SupabaseClient,
  participantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("guardian_consents")
    .select("id")
    .eq("guide_participant_id", participantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

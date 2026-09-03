import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GUARDIAN_DISCLOSURE_TEXT } from "./youth-assent-text";

// AVAIA Youth Defying Grief -- Guardian Consent + Youth Privacy & Agency.
// Governing model: "The guardian gives permission for participation. The
// Youth Host retains ownership of their story and agency over what they
// choose to share." This module owns the record/query helpers against
// guardian_consents; the actual disclosure/assent text lives in
// lib/youth-assent-text.ts (deliberately NOT server-only, since the
// Guide-facilitated start forms and /youth's band selector are client
// components that need to render the correct band's text as it's picked,
// before any server round-trip) and is re-exported here so server code
// that needs both the text and the DB helpers has one import. This module
// has no relationship to content access -- RLS on conversations, messages,
// referrals, and recognitions already scopes those to the Host (or the
// Guide's own guide_sessions ownership) alone, entirely unchanged here.
export { GUARDIAN_DISCLOSURE_VERSION, GUARDIAN_DISCLOSURE_TEXT, YOUTH_ASSENT_TEXT } from "./youth-assent-text";

export type GuardianConsentScope = "individual" | "group_workshop" | "school_organization";

// 'guide_or_self_attested': a Guide (or the Youth Host themselves at
// /welcome) directly enters the guardian's name/email and confirms consent
// was already collected -- immediately active. Real-world-necessary (a
// signed paper form at a school, a verbal exchange in person) and kept as
// a valid path, not merely a legacy fallback.
// 'guardian_link_confirmed': a unique, unguessable link is generated
// instead; the record starts 'pending' and only becomes 'active' when the
// guardian themselves opens that link and confirms -- a real step toward
// COPPA's lighter "email plus" pathway for internal-use-only data (see
// migration 0043's own header for the researched basis), though not a
// claim of fully meeting it. See 0043's confirm_pending_consent function
// for the guardian-side action this enables.
export type VerificationMethod = "guide_or_self_attested" | "guardian_link_confirmed";

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
  status: "pending" | "active" | "revoked";
  verification_method: VerificationMethod;
  consent_token: string | null;
  confirmed_at: string | null;
  assent_confirmed_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function generateConsentToken(): string {
  return randomBytes(24).toString("hex");
}

type InsertResult = { error: string | null; consentToken: string | null };

async function insertGuardianConsent(
  supabase: SupabaseClient,
  fields: Record<string, unknown>,
  verificationMethod: VerificationMethod,
  assentConfirmed: boolean
): Promise<InsertResult> {
  const isLinkBased = verificationMethod === "guardian_link_confirmed";
  const consentToken = isLinkBased ? generateConsentToken() : null;
  const { error } = await supabase.from("guardian_consents").insert({
    ...fields,
    disclosure_text: GUARDIAN_DISCLOSURE_TEXT,
    verification_method: verificationMethod,
    status: isLinkBased ? "pending" : "active",
    consent_token: consentToken,
    token_created_at: isLinkBased ? new Date().toISOString() : null,
    assent_confirmed_at: assentConfirmed ? new Date().toISOString() : null,
  });
  return { error: error?.message ?? null, consentToken };
}

/** Records (or begins) a guardian consent for a self-serve Youth Host.
 *  Called from /api/consent when age === "minor" -- the same request that
 *  already sets profiles.minor_with_guardian. `supabase` must be the
 *  caller's own RLS-scoped client (matches this route's existing
 *  pattern) -- RLS enforces youth_host_id/recorded_by = auth.uid()
 *  regardless. Returns a consentToken when verificationMethod is
 *  'guardian_link_confirmed', so the caller can render the guardian-
 *  facing link (/consent/[token]). */
export async function recordGuardianConsentForYouthHost(
  supabase: SupabaseClient,
  youthHostId: string,
  guardianName: string,
  guardianEmail: string,
  verificationMethod: VerificationMethod,
  assentConfirmed: boolean
): Promise<InsertResult> {
  return insertGuardianConsent(
    supabase,
    {
      youth_host_id: youthHostId,
      scope: "individual",
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      relationship: "parent or guardian",
      recorded_by: youthHostId,
    },
    verificationMethod,
    assentConfirmed
  );
}

/** Records (or begins) a guardian consent a Guide has collected for a
 *  Guide-facilitated participant -- individual, group/workshop, or a
 *  school/organization-sponsored context. `supabase` must be the Guide's
 *  own RLS-scoped client; RLS enforces the participant belongs to this
 *  Guide and recorded_by = auth.uid(). Returns a consentToken when
 *  verificationMethod is 'guardian_link_confirmed'. */
export async function recordGuardianConsentForParticipant(
  supabase: SupabaseClient,
  guideId: string,
  participantId: string,
  scope: GuardianConsentScope,
  guardianName: string,
  guardianEmail: string,
  sponsoringOrganization: string | null,
  verificationMethod: VerificationMethod,
  assentConfirmed: boolean
): Promise<InsertResult> {
  return insertGuardianConsent(
    supabase,
    {
      guide_participant_id: participantId,
      scope,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      relationship: scope === "school_organization" ? "sponsoring organization contact" : "parent or guardian",
      sponsoring_organization: sponsoringOrganization,
      recorded_by: guideId,
    },
    verificationMethod,
    assentConfirmed
  );
}

/** The one place "cleared to participate" is decided for a Guide-
 *  facilitated participant -- active guardian consent (whichever
 *  verification method reached it) AND the Guide's confirmation that
 *  Youth assent was delivered, for a Youth participant (a developmental
 *  band on record). Used both to render status in a roster and,
 *  critically, to actually block session creation -- see
 *  app/toolkit/iap/[sessionId]/page.tsx and the Youth Defying Grief /
 *  Unsung Heroes start actions, which now check this before creating a
 *  guide_sessions row rather than only checking "does a consent row
 *  exist."
 *
 *  An ADULT participant (no developmental_band on record) has no
 *  guardian-consent concept at all and is simply always cleared -- found
 *  as a real defect during the Organization Administrator build: this
 *  function previously required a band unconditionally, which meant an
 *  adult registered through the youth_programs roster system (reused
 *  generically for Adult organizational programs too, e.g. an Adult
 *  Defying Grief cohort -- see that build's own reasoning) could never
 *  actually be launched. "Start session" never appeared for them, and
 *  the server action would have redirected away even if it had. Fixed
 *  here, at the one shared source, so every caller -- the Guide's own
 *  roster page and the Organization Administrator dashboard alike --
 *  is correct and consistent, rather than diverging per caller. */
export async function isParticipantClearedToParticipate(
  supabase: SupabaseClient,
  participantId: string
): Promise<boolean> {
  const { data: participant } = await supabase
    .from("guide_participants")
    .select("developmental_band")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant?.developmental_band) return true;

  const { data: consent } = await supabase
    .from("guardian_consents")
    .select("status, assent_confirmed_at")
    .eq("guide_participant_id", participantId)
    .eq("status", "active")
    .not("assent_confirmed_at", "is", null)
    .limit(1)
    .maybeSingle();
  return !!consent;
}

/** Whether an active (non-revoked, non-pending) guardian consent already
 *  exists for a Guide-facilitated participant -- lets a Guide start a
 *  second Youth session for a returning, already-cleared participant
 *  without re-collecting consent every time. */
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

/** The consent status shown in a roster -- one of four states a Guide
 *  needs to distinguish at a glance: no consent record at all yet,
 *  waiting on the guardian's own action, fully active, or revoked. */
export async function getConsentStatusForParticipant(
  supabase: SupabaseClient,
  participantId: string
): Promise<{ status: "none" | "pending" | "active" | "revoked"; assentConfirmed: boolean }> {
  const { data } = await supabase
    .from("guardian_consents")
    .select("status, assent_confirmed_at")
    .eq("guide_participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { status: "none", assentConfirmed: false };
  return { status: data.status as "pending" | "active" | "revoked", assentConfirmed: !!data.assent_confirmed_at };
}

/** Revokes a guardian consent -- e.g. the guardian withdraws permission,
 *  or a Youth Host turns 18. `supabase` must be the caller's own
 *  RLS-scoped client; RLS (0041) already restricts this to the owning
 *  Host or the owning Guide. */
export async function revokeGuardianConsent(
  supabase: SupabaseClient,
  consentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("guardian_consents")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", consentId);
  return { error: error?.message ?? null };
}

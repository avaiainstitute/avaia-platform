import "server-only";
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

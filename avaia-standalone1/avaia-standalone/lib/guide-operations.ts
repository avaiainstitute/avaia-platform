import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AVAIA Guide Operations Agent -- typed, deterministic resolver. This
 * module keeps a Certified Guide's certification standing, platform
 * permissions, Toolkit authorization, and Host-scoped access aligned with
 * what AVAIA has actually granted. It NEVER makes a certification,
 * suspension, revocation, authorization, safety, or institutional-policy
 * judgment -- it reads existing records and reports mechanical facts and
 * deterministic mismatches between them.
 *
 * Preserves every distinction the governing instruction lists as separate:
 * certification decision, certification record, certification standing,
 * profiles.role, guide_platform_authorizations, Toolkit access, Host-scoped
 * Guide access, and (future) Program/Advanced Authorizations are never
 * collapsed into one status here. guide_certifications.standing
 * ('active' | 'paused' | 'revoked') remains the one authoritative standing
 * value; this module only derives a read-only operational view on top.
 */

export type CertificationStanding = "active" | "paused" | "revoked" | null;

export const GUIDE_MISMATCH_TYPES = [
  "active_certification_missing_operational_access",
  "paused_certification_active_access",
  "revoked_certification_active_access",
  "toolkit_authorization_without_active_certification",
  "journey_authorization_without_active_certification",
  "host_access_without_valid_standing",
  "role_guide_without_certification",
  "incomplete_certification_handoff",
] as const;

export type GuideMismatchType = (typeof GUIDE_MISMATCH_TYPES)[number];

export type GuideMismatch = { type: GuideMismatchType; detail: string };

export const GUIDE_OPERATIONAL_STATES = [
  "healthy",
  "permission_mismatch",
  "paused",
  "revoked",
  "human_review_required",
  "not_certified",
] as const;

export type GuideOperationalState = (typeof GUIDE_OPERATIONAL_STATES)[number];

export type GuideOperationsRecord = {
  hostId: string;
  profileRole: string | null;
  certificationStanding: CertificationStanding;
  certifiedAt: string | null;
  toolkitAuthorized: boolean;
  journeyFacilitationAuthorized: boolean;
  activeHostScopedAccessCount: number;
  operationalState: GuideOperationalState;
  mismatches: GuideMismatch[];
  humanActionRequired: boolean;
};

/** Pure derivation -- every input here is a fact already read from one
 *  existing table/column each (see lib/ops/guide-access-operations.ts for
 *  the I/O that supplies these). Nothing here decides whether a mismatch
 *  SHOULD be corrected -- it only reports that one exists. */
export function deriveGuideOperationalState(args: {
  profileRole: string | null;
  certificationStanding: CertificationStanding;
  toolkitAuthorized: boolean;
  journeyFacilitationAuthorized: boolean;
  activeHostScopedAccessCount: number;
}): { state: GuideOperationalState; mismatches: GuideMismatch[]; humanActionRequired: boolean } {
  const { profileRole, certificationStanding, toolkitAuthorized, journeyFacilitationAuthorized, activeHostScopedAccessCount } =
    args;
  const isRoleGuide = profileRole === "guide";
  const hasCertification = certificationStanding !== null;
  const hasAnyOperationalAccess =
    isRoleGuide || toolkitAuthorized || journeyFacilitationAuthorized || activeHostScopedAccessCount > 0;
  const mismatches: GuideMismatch[] = [];

  // role_guide_without_certification -- a role label alone is never
  // sufficient Guide permission; this is the specific, deterministic case
  // of that principle.
  if (isRoleGuide && !hasCertification) {
    mismatches.push({
      type: "role_guide_without_certification",
      detail: "profiles.role is 'guide' but no guide_certifications record exists for this account.",
    });
  }

  // active_certification_missing_operational_access -- certified and in
  // good standing, but the role/handoff never completed.
  if (certificationStanding === "active" && !isRoleGuide) {
    mismatches.push({
      type: "active_certification_missing_operational_access",
      detail: "Certification standing is active, but profiles.role is not 'guide'.",
    });
  }

  // paused / revoked + still-active access -- the deterministic gap this
  // build exists to catch. Any of role/toolkit/journey/host-scoped access
  // still present after standing leaves 'active' is surfaced.
  if (certificationStanding === "paused" && hasAnyOperationalAccess) {
    mismatches.push({
      type: "paused_certification_active_access",
      detail: "Certification standing is paused, but operational Guide access is still present.",
    });
  }
  if (certificationStanding === "revoked" && hasAnyOperationalAccess) {
    mismatches.push({
      type: "revoked_certification_active_access",
      detail: "Certification standing is revoked, but operational Guide access is still present.",
    });
  }

  // Explicit platform-authorization capabilities active without active
  // certification standing -- authorization alone is never sufficient.
  if (toolkitAuthorized && certificationStanding !== "active") {
    mismatches.push({
      type: "toolkit_authorization_without_active_certification",
      detail: `Toolkit platform authorization is active, but certification standing is ${
        certificationStanding ?? "absent"
      }.`,
    });
  }
  if (journeyFacilitationAuthorized && certificationStanding !== "active") {
    mismatches.push({
      type: "journey_authorization_without_active_certification",
      detail: `Guided Journey Facilitation authorization is active, but certification standing is ${
        certificationStanding ?? "absent"
      }.`,
    });
  }

  // Host-scoped access (guide_journey_access, explicit/scoped/revocable)
  // present without valid standing.
  if (activeHostScopedAccessCount > 0 && certificationStanding !== "active") {
    mismatches.push({
      type: "host_access_without_valid_standing",
      detail: `${activeHostScopedAccessCount} active Host-scoped relationship(s) exist, but certification standing is ${
        certificationStanding ?? "absent"
      }.`,
    });
  }

  // incomplete_certification_handoff -- active standing but the explicit
  // platform authorizations that make it operationally meaningful were
  // never granted.
  if (certificationStanding === "active" && isRoleGuide && !toolkitAuthorized && !journeyFacilitationAuthorized) {
    mismatches.push({
      type: "incomplete_certification_handoff",
      detail: "Certification standing is active and profiles.role is 'guide', but no platform authorization (Toolkit or Guided Journey Facilitation) has been granted yet.",
    });
  }

  let state: GuideOperationalState;
  if (!hasCertification && !hasAnyOperationalAccess) {
    state = "not_certified";
  } else if (certificationStanding === "revoked") {
    state = "revoked";
  } else if (certificationStanding === "paused") {
    state = "paused";
  } else if (mismatches.some((m) => m.type === "role_guide_without_certification" || m.type === "incomplete_certification_handoff")) {
    state = "human_review_required";
  } else if (mismatches.length > 0) {
    state = "permission_mismatch";
  } else {
    state = "healthy";
  }

  return { state, mismatches, humanActionRequired: state !== "healthy" };
}

type RawGuideRow = {
  hostId: string;
  profileRole: string | null;
  certificationStanding: CertificationStanding;
  certifiedAt: string | null;
  toolkitAuthorized: boolean;
  journeyFacilitationAuthorized: boolean;
  activeHostScopedAccessCount: number;
};

/** Builds one GuideOperationsRecord per candidate row. Kept pure and
 *  separate from I/O (lib/ops/guide-access-operations.ts) so the
 *  derivation logic above is independently testable. */
export function buildGuideOperationsRecords(rows: RawGuideRow[]): GuideOperationsRecord[] {
  return rows.map((row) => {
    const { state, mismatches, humanActionRequired } = deriveGuideOperationalState({
      profileRole: row.profileRole,
      certificationStanding: row.certificationStanding,
      toolkitAuthorized: row.toolkitAuthorized,
      journeyFacilitationAuthorized: row.journeyFacilitationAuthorized,
      activeHostScopedAccessCount: row.activeHostScopedAccessCount,
    });
    return {
      hostId: row.hostId,
      profileRole: row.profileRole,
      certificationStanding: row.certificationStanding,
      certifiedAt: row.certifiedAt,
      toolkitAuthorized: row.toolkitAuthorized,
      journeyFacilitationAuthorized: row.journeyFacilitationAuthorized,
      activeHostScopedAccessCount: row.activeHostScopedAccessCount,
      operationalState: state,
      mismatches,
      humanActionRequired,
    };
  });
}

/** Single-Guide convenience accessor for a Guide's own "My Guide Status"
 *  view (app/toolkit/page.tsx) -- uses the ordinary RLS-respecting client,
 *  never the admin client, so a Guide can only ever resolve their own
 *  record (every table read here already has a "self read: auth.uid() =
 *  host_id/guide_id" policy). Mirrors the shape of
 *  getCertificationOperationsRecordForCandidate in
 *  lib/certification-operations.ts. */
export async function getGuideOperationsRecordForHost(
  supabase: SupabaseClient,
  hostId: string
): Promise<GuideOperationsRecord> {
  const [{ data: profile }, { data: cert }, { data: authRows }, { data: journeyAccessRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", hostId).maybeSingle(),
    supabase.from("guide_certifications").select("standing, certified_at").eq("host_id", hostId).maybeSingle(),
    supabase
      .from("guide_platform_authorizations")
      .select("capability, status, granted_at, status_changed_at")
      .eq("host_id", hostId),
    supabase.from("guide_journey_access").select("id").eq("guide_id", hostId).is("revoked_at", null),
  ]);

  const authRowsTyped = (authRows ?? []) as {
    capability: "toolkit" | "guided_journey_facilitation";
    status: "authorized" | "revoked";
    granted_at: string;
    status_changed_at: string | null;
  }[];
  const ts = (r: { granted_at: string; status_changed_at: string | null }) =>
    new Date(r.status_changed_at ?? r.granted_at).getTime();
  const latestByCapability = new Map<string, "authorized" | "revoked">();
  for (const row of [...authRowsTyped].sort((a, b) => ts(a) - ts(b))) {
    latestByCapability.set(row.capability, row.status);
  }

  const certTyped = cert as { standing: string; certified_at: string } | null;

  const [record] = buildGuideOperationsRecords([
    {
      hostId,
      profileRole: (profile as { role: string | null } | null)?.role ?? null,
      certificationStanding: (certTyped?.standing as CertificationStanding) ?? null,
      certifiedAt: certTyped?.certified_at ?? null,
      toolkitAuthorized: latestByCapability.get("toolkit") === "authorized",
      journeyFacilitationAuthorized: latestByCapability.get("guided_journey_facilitation") === "authorized",
      activeHostScopedAccessCount: (journeyAccessRows ?? []).length,
    },
  ]);
  return record;
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AVAIA Guide Operations: typed, deterministic rules. This keeps a Certified
 * Guide's certification standing, platform authorizations, Toolkit access and
 * Host-scoped access aligned with what AVAIA has actually granted. It NEVER
 * makes a certification, suspension, revocation, authorization, safety, or
 * policy judgment: it reads existing records and reports mechanical facts and
 * deterministic mismatches between them. A mismatch is surfaced to Dorian
 * through What Needs Dorian (lib/ops/guide-access-operations.ts); nothing here
 * ever changes a standing, an authorization, or a grant.
 *
 * Adapted to current production architecture (the original build predates it):
 *  - guide_certifications.standing is 'active' | 'paused' | 'revoked' | 'inactive'.
 *    'inactive' is the automatic lapse at the end of a 365-day period
 *    (lib/certification-renewal.ts). By design the lapse leaves authorization
 *    and Host-access records in place so reactivation restores them, and the
 *    live gates (isToolkitAuthorized etc.) already deny while standing is not
 *    'active'. So records remaining under 'inactive' are EXPECTED, not a
 *    mismatch.
 *  - Access no longer follows profiles.role: the Toolkit and facilitation gates
 *    read certification + authorization. The role label still matters in one
 *    place, older database rules (Library guide read, class and experience
 *    rules) that grant access to role = 'guide', so a 'guide' role without an
 *    active certification is a real access leak and is reported.
 *  - "Certified but no Toolkit authorization yet" is the certification
 *    pipeline's `activation_pending` item (lib/certification-operations.ts),
 *    reported once there, not again here.
 *
 * Preserves every distinction as separate: certification decision, certification
 * record, certification standing, profiles.role, platform authorizations,
 * Toolkit access, and Host-scoped Guide access are never collapsed into one status.
 */

export type CertificationStanding = "active" | "paused" | "revoked" | "inactive" | null;

export const GUIDE_MISMATCH_TYPES = [
  "role_guide_without_active_certification",
  "authorization_without_valid_certification",
  "host_access_without_valid_standing",
] as const;

export type GuideMismatchType = (typeof GUIDE_MISMATCH_TYPES)[number];

export type GuideMismatch = { type: GuideMismatchType; detail: string };

export const GUIDE_OPERATIONAL_STATES = [
  "healthy",
  "permission_mismatch",
  "paused",
  "revoked",
  "inactive",
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

const describeStanding = (s: CertificationStanding) => s ?? "absent";

/** Pure derivation: every input is a fact already read from one existing
 *  table/column. Nothing here decides whether a mismatch SHOULD be corrected;
 *  it only reports that one exists. */
export function deriveGuideOperationalState(args: {
  profileRole: string | null;
  certificationStanding: CertificationStanding;
  toolkitAuthorized: boolean;
  journeyFacilitationAuthorized: boolean;
  activeHostScopedAccessCount: number;
}): { state: GuideOperationalState; mismatches: GuideMismatch[]; humanActionRequired: boolean } {
  const { profileRole, certificationStanding: standing, toolkitAuthorized, journeyFacilitationAuthorized, activeHostScopedAccessCount } = args;
  const isRoleGuide = profileRole === "guide";
  const hasCertification = standing !== null;
  const mismatches: GuideMismatch[] = [];

  // Under 'inactive' the lapse deliberately keeps authorizations and Host
  // access in place (and the gates deny), so only these standings mean a
  // record should not still be live.
  const accessShouldNotRemain = standing === null || standing === "paused" || standing === "revoked";

  // A 'guide' role label is real access through older database rules, so it
  // must never outlive an active certification (an inactive/lapsed one too).
  if (isRoleGuide && standing !== "active") {
    mismatches.push({
      type: "role_guide_without_active_certification",
      detail: `The account's role is 'guide' (which older Library and class rules still honor), but certification standing is ${describeStanding(standing)}.`,
    });
  }

  if (accessShouldNotRemain) {
    if (toolkitAuthorized) {
      mismatches.push({
        type: "authorization_without_valid_certification",
        detail: `Toolkit authorization is still active, but certification standing is ${describeStanding(standing)}.`,
      });
    }
    if (journeyFacilitationAuthorized) {
      mismatches.push({
        type: "authorization_without_valid_certification",
        detail: `Guided Journey Facilitation authorization is still active, but certification standing is ${describeStanding(standing)}.`,
      });
    }
    if (activeHostScopedAccessCount > 0) {
      mismatches.push({
        type: "host_access_without_valid_standing",
        detail: `${activeHostScopedAccessCount} active Host-scoped relationship(s) exist, but certification standing is ${describeStanding(standing)}.`,
      });
    }
  }

  let state: GuideOperationalState;
  if (!hasCertification && !isRoleGuide && !toolkitAuthorized && !journeyFacilitationAuthorized && activeHostScopedAccessCount === 0) {
    state = "not_certified";
  } else if (mismatches.length > 0) {
    state = "permission_mismatch";
  } else if (standing === "revoked") {
    state = "revoked";
  } else if (standing === "paused") {
    state = "paused";
  } else if (standing === "inactive") {
    state = "inactive";
  } else {
    state = "healthy";
  }

  return { state, mismatches, humanActionRequired: mismatches.length > 0 };
}

export type RawGuideRow = {
  hostId: string;
  profileRole: string | null;
  certificationStanding: CertificationStanding;
  certifiedAt: string | null;
  toolkitAuthorized: boolean;
  journeyFacilitationAuthorized: boolean;
  activeHostScopedAccessCount: number;
};

/** Builds one GuideOperationsRecord per row. Pure and separate from I/O
 *  (lib/ops/guide-access-operations.ts) so the rules above are independently testable. */
export function buildGuideOperationsRecords(rows: RawGuideRow[]): GuideOperationsRecord[] {
  return rows.map((row) => {
    const { state, mismatches, humanActionRequired } = deriveGuideOperationalState({
      profileRole: row.profileRole,
      certificationStanding: row.certificationStanding,
      toolkitAuthorized: row.toolkitAuthorized,
      journeyFacilitationAuthorized: row.journeyFacilitationAuthorized,
      activeHostScopedAccessCount: row.activeHostScopedAccessCount,
    });
    return { ...row, operationalState: state, mismatches, humanActionRequired };
  });
}

/** Latest status per capability from raw authorization rows (history is kept:
 *  a revoked then re-granted authorization has several rows). */
export function latestAuthorizationByCapability(
  rows: { capability: "toolkit" | "guided_journey_facilitation"; status: "authorized" | "revoked"; granted_at: string; status_changed_at: string | null }[]
): Map<string, "authorized" | "revoked"> {
  const ts = (r: { granted_at: string; status_changed_at: string | null }) => new Date(r.status_changed_at ?? r.granted_at).getTime();
  const latest = new Map<string, "authorized" | "revoked">();
  for (const row of [...rows].sort((a, b) => ts(a) - ts(b))) latest.set(row.capability, row.status);
  return latest;
}

/** A Guide's own "My Guide Status" (shown on the Toolkit page). Uses the
 *  ordinary RLS-respecting client, never the admin client, so a Guide can only
 *  ever resolve their own record: every table read here has a self-read policy
 *  (auth.uid() = host_id / guide_id). */
export async function getGuideOperationsRecordForHost(supabase: SupabaseClient, hostId: string): Promise<GuideOperationsRecord> {
  const [{ data: profile }, { data: cert }, { data: authRows }, { data: journeyAccessRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", hostId).maybeSingle(),
    supabase.from("guide_certifications").select("standing, certified_at").eq("host_id", hostId).maybeSingle(),
    supabase.from("guide_platform_authorizations").select("capability, status, granted_at, status_changed_at").eq("host_id", hostId),
    supabase.from("guide_journey_access").select("id").eq("guide_id", hostId).is("revoked_at", null),
  ]);

  const latest = latestAuthorizationByCapability(
    (authRows ?? []) as { capability: "toolkit" | "guided_journey_facilitation"; status: "authorized" | "revoked"; granted_at: string; status_changed_at: string | null }[]
  );
  const certTyped = cert as { standing: string; certified_at: string } | null;

  const [record] = buildGuideOperationsRecords([
    {
      hostId,
      profileRole: (profile as { role: string | null } | null)?.role ?? null,
      certificationStanding: (certTyped?.standing as CertificationStanding) ?? null,
      certifiedAt: certTyped?.certified_at ?? null,
      toolkitAuthorized: latest.get("toolkit") === "authorized",
      journeyFacilitationAuthorized: latest.get("guided_journey_facilitation") === "authorized",
      activeHostScopedAccessCount: (journeyAccessRows ?? []).length,
    },
  ]);
  return record;
}

import "server-only";

/**
 * AVAIA Organization / Event Operations Agent -- typed, deterministic
 * resolver. Audited against the current repository and live schema before
 * writing anything here (see the final report for the full audit). The
 * audit's central finding governs this file's scope:
 *
 *  - `organizations`, `organization_admins`, `organization_guides`, and
 *    `organization_admin_actions` exist in schema, with full RLS already
 *    designed (admin-all, self-read, creator-write, Guide-toolkit-read),
 *    but have ZERO application code references anywhere and ZERO rows in
 *    the live database. They are schema-ready, not wired in.
 *  - There is NO event, Experience-instance, registration, roster,
 *    attendance, check-in, waitlist, cohort, or presenter table anywhere
 *    in the schema -- not orphaned, not partially built, simply absent.
 *  - `experiences` / `classes` / `experience_classes` / `experience_sections`
 *    are a real, populated (22/30 rows) Experience *content* catalog, but
 *    also have zero application code references -- this is the
 *    Experience-content lifecycle the governing instruction explicitly
 *    says to keep distinct from an event instance, and this build does
 *    not touch it (no event-instance concept exists to attach it to).
 *
 * Given that, this module derives only what is actually provable:
 * read-only Organization operational state (does the organization have an
 * authorized admin, does it have any connected Guides, and are those
 * Guides' own certification/authorization still valid right now -- reusing
 * Guide Operations rather than re-deriving it). It does NOT model an
 * event-instance lifecycle (planning/registration_open/.../closed),
 * registration, roster, attendance, or preflight beyond Guide-coverage
 * validity, because none of the records those would need to be grounded
 * in exist. Building any of that now would be inventing infrastructure,
 * not auditing it -- exactly what the governing instruction prohibits.
 */

export const ORGANIZATION_ADMIN_STATUSES = ["authorized", "revoked"] as const;
export type OrganizationAdminStatus = (typeof ORGANIZATION_ADMIN_STATUSES)[number];

export const ORGANIZATION_GUIDE_STATUSES = ["connected", "disconnected"] as const;
export type OrganizationGuideStatus = (typeof ORGANIZATION_GUIDE_STATUSES)[number];

export const ORGANIZATION_OPERATIONAL_STATES = [
  "no_admin_assigned",
  "no_guides_connected",
  "guide_coverage_mismatch",
  "ready",
  "operational_mismatch",
] as const;

export type OrganizationOperationalState = (typeof ORGANIZATION_OPERATIONAL_STATES)[number];

export const ORGANIZATION_MISMATCH_TYPES = [
  "connected_guide_not_certified",
  "connected_guide_not_toolkit_authorized",
  "duplicate_active_admin_grant",
] as const;

export type OrganizationMismatchType = (typeof ORGANIZATION_MISMATCH_TYPES)[number];

export type OrganizationMismatch = { type: OrganizationMismatchType; detail: string };

export type OrganizationGuideConnection = {
  guideId: string;
  status: OrganizationGuideStatus;
  /** Reused from Guide Operations (lib/guide-operations.ts) rather than
   *  re-derived -- a connected Guide's own certification standing and
   *  Toolkit authorization are exactly what item 7 of the governing
   *  instruction says to verify before any assignment is treated as
   *  valid. This module never waives a missing requirement. */
  certificationActive: boolean;
  toolkitAuthorized: boolean;
};

export type OrganizationRecord = {
  organizationId: string;
  hasAuthorizedAdmin: boolean;
  connectedGuides: OrganizationGuideConnection[];
  operationalState: OrganizationOperationalState;
  mismatches: OrganizationMismatch[];
  humanActionRequired: boolean;
};

/** Pure derivation for one organization. `adminStatuses` is every
 *  organization_admins.status this org currently has (latest-per-host
 *  already resolved by the caller, the same "latest by status_changed_at"
 *  pattern used throughout this codebase for authorization-history
 *  tables). `guideConnections` is every currently-"connected"
 *  organization_guides row for this org, each already cross-checked
 *  against that Guide's real Guide Operations record. */
export function deriveOrganizationState(args: {
  adminStatuses: OrganizationAdminStatus[];
  guideConnections: OrganizationGuideConnection[];
}): { state: OrganizationOperationalState; mismatches: OrganizationMismatch[]; humanActionRequired: boolean } {
  const { adminStatuses, guideConnections } = args;
  const mismatches: OrganizationMismatch[] = [];

  const authorizedAdminCount = adminStatuses.filter((s) => s === "authorized").length;
  const hasAuthorizedAdmin = authorizedAdminCount > 0;
  if (authorizedAdminCount > 1) {
    mismatches.push({
      type: "duplicate_active_admin_grant",
      detail: `${authorizedAdminCount} simultaneously authorized organization admin grants exist; this is not itself prohibited by the schema, but is worth a human glance.`,
    });
  }

  for (const guide of guideConnections) {
    if (!guide.certificationActive) {
      mismatches.push({
        type: "connected_guide_not_certified",
        detail: `Guide ${guide.guideId} is connected to this organization but does not currently have active certification standing.`,
      });
    }
    if (!guide.toolkitAuthorized) {
      mismatches.push({
        type: "connected_guide_not_toolkit_authorized",
        detail: `Guide ${guide.guideId} is connected to this organization but is not currently Toolkit-authorized.`,
      });
    }
  }

  let state: OrganizationOperationalState;
  if (!hasAuthorizedAdmin) {
    state = "no_admin_assigned";
  } else if (guideConnections.length === 0) {
    state = "no_guides_connected";
  } else if (mismatches.some((m) => m.type !== "duplicate_active_admin_grant")) {
    state = "guide_coverage_mismatch";
  } else if (mismatches.length > 0) {
    state = "operational_mismatch";
  } else {
    state = "ready";
  }

  return { state, mismatches, humanActionRequired: state !== "ready" };
}

type RawOrganizationRow = {
  organizationId: string;
  adminStatuses: OrganizationAdminStatus[];
  guideConnections: OrganizationGuideConnection[];
};

/** Builds one OrganizationRecord per organization row. Kept pure and
 *  separate from I/O (lib/ops/organization-operations.ts), mirroring
 *  buildGuideOperationsRecords / buildHostJourneyRecords. */
export function buildOrganizationRecords(rows: RawOrganizationRow[]): OrganizationRecord[] {
  return rows.map((row) => {
    const { state, mismatches, humanActionRequired } = deriveOrganizationState({
      adminStatuses: row.adminStatuses,
      guideConnections: row.guideConnections,
    });
    return {
      organizationId: row.organizationId,
      hasAuthorizedAdmin: row.adminStatuses.includes("authorized"),
      connectedGuides: row.guideConnections,
      operationalState: state,
      mismatches,
      humanActionRequired,
    };
  });
}

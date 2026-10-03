import "server-only";

/**
 * AVAIA Organization Operations: typed, deterministic rules. Keeps each
 * organization's own operational readiness visible: does it have an authorized
 * administrator, does it have connected Guides, and are those Guides' own
 * certification and Toolkit authorization still valid right now. It reuses
 * Guide Operations' records for each connected Guide (lib/guide-operations.ts)
 * rather than re-deriving them, and it never waives a missing requirement.
 *
 * It models what the schema actually holds today: organizations,
 * organization_admins and organization_guides (the Organization Administrator V1
 * built in lib/organization-admin.ts). There is no event, registration, roster or
 * attendance record anywhere in the product yet (the Workshops/Events pathway is
 * planned, not built), so there is nothing event-shaped to operate: the moment
 * event records exist they extend THIS capability. Nothing here ever changes a
 * grant, a connection, or an administrator; it reports.
 *
 * Organization Administrators administer access, participation, people and
 * programs but never a Host's story: nothing here reads Host content.
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

export type OrganizationMismatch = { type: OrganizationMismatchType; guideId?: string; detail: string };

export type OrganizationGuideConnection = {
  guideId: string;
  status: OrganizationGuideStatus;
  /** Reused from Guide Operations rather than re-derived. */
  certificationActive: boolean;
  toolkitAuthorized: boolean;
};

export type OrganizationRecord = {
  organizationId: string;
  name: string;
  hasAuthorizedAdmin: boolean;
  connectedGuides: OrganizationGuideConnection[];
  operationalState: OrganizationOperationalState;
  mismatches: OrganizationMismatch[];
  humanActionRequired: boolean;
};

/** Pure derivation for one organization. */
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
      detail: `${authorizedAdminCount} organization administrators are authorized at the same time; the schema allows it, but it is worth a human glance.`,
    });
  }

  for (const guide of guideConnections) {
    if (!guide.certificationActive) {
      mismatches.push({
        type: "connected_guide_not_certified",
        guideId: guide.guideId,
        detail: "A connected Guide does not currently have active certification standing.",
      });
    }
    if (!guide.toolkitAuthorized) {
      mismatches.push({
        type: "connected_guide_not_toolkit_authorized",
        guideId: guide.guideId,
        detail: "A connected Guide is not currently Toolkit-authorized.",
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

export type RawOrganizationRow = {
  organizationId: string;
  name: string;
  adminStatuses: OrganizationAdminStatus[];
  guideConnections: OrganizationGuideConnection[];
};

/** Builds one OrganizationRecord per organization row. Pure and separate from I/O
 *  (lib/ops/organization-operations.ts). */
export function buildOrganizationRecords(rows: RawOrganizationRow[]): OrganizationRecord[] {
  return rows.map((row) => {
    const { state, mismatches, humanActionRequired } = deriveOrganizationState({
      adminStatuses: row.adminStatuses,
      guideConnections: row.guideConnections,
    });
    return {
      organizationId: row.organizationId,
      name: row.name,
      hasAuthorizedAdmin: row.adminStatuses.includes("authorized"),
      connectedGuides: row.guideConnections,
      operationalState: state,
      mismatches,
      humanActionRequired,
    };
  });
}

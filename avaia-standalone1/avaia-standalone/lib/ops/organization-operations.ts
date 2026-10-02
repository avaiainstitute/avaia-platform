import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllGuideOperationsRecords } from "@/lib/ops/guide-access-operations";
import {
  buildOrganizationRecords,
  type OrganizationRecord,
  type OrganizationAdminStatus,
  type OrganizationGuideStatus,
  type OrganizationGuideConnection,
} from "@/lib/organization-operations";

// Organization / Event Operations Agent -- admin-client batched fetch.
// Mirrors lib/ops/guide-access-operations.ts's own shape: one admin-client
// pass over the relevant tables, pure derivation
// (lib/organization-operations.ts), reusing Guide Operations' own records
// for Guide validity rather than re-deriving certification/authorization a
// second time. No cron/exception table is added here (see the final
// report's item 6 for why) -- there are zero organizations on file today
// and no application entry point creates one, so a notification cron
// would have nothing real to notify about yet.

/** Every organization, with its admin-grant statuses and connected-Guide
 *  validity resolved. Currently returns an empty array in production
 *  (organizations has zero rows), but is written against the real schema
 *  and RLS so it is correct the moment an organization row exists. */
export async function getAllOrganizationRecords(): Promise<OrganizationRecord[]> {
  const admin = createAdminClient();

  const [{ data: orgRows }, { data: adminRows }, { data: guideConnRows }] = await Promise.all([
    admin.from("organizations").select("id"),
    admin.from("organization_admins").select("organization_id, status"),
    admin.from("organization_guides").select("organization_id, guide_id, status").eq("status", "connected"),
  ]);

  const adminStatusesByOrg = new Map<string, OrganizationAdminStatus[]>();
  for (const row of (adminRows ?? []) as { organization_id: string; status: OrganizationAdminStatus }[]) {
    const list = adminStatusesByOrg.get(row.organization_id) ?? [];
    list.push(row.status);
    adminStatusesByOrg.set(row.organization_id, list);
  }

  const guideConnRowsTyped = (guideConnRows ?? []) as { organization_id: string; guide_id: string; status: OrganizationGuideStatus }[];
  const guideIds = [...new Set(guideConnRowsTyped.map((r) => r.guide_id))];

  // Reuse Guide Operations' own records for each connected Guide's real
  // certification standing and Toolkit authorization -- never re-derived,
  // never waived here.
  const guideOperationsRecords = guideIds.length ? await getAllGuideOperationsRecords() : [];
  const guideOpsById = new Map(guideOperationsRecords.map((g) => [g.hostId, g]));

  const guideConnectionsByOrg = new Map<string, OrganizationGuideConnection[]>();
  for (const row of guideConnRowsTyped) {
    const guideOps = guideOpsById.get(row.guide_id);
    const connection: OrganizationGuideConnection = {
      guideId: row.guide_id,
      status: row.status,
      certificationActive: guideOps?.certificationStanding === "active",
      toolkitAuthorized: guideOps?.toolkitAuthorized === true,
    };
    const list = guideConnectionsByOrg.get(row.organization_id) ?? [];
    list.push(connection);
    guideConnectionsByOrg.set(row.organization_id, list);
  }

  const rows = ((orgRows ?? []) as { id: string }[]).map((org) => ({
    organizationId: org.id,
    adminStatuses: adminStatusesByOrg.get(org.id) ?? [],
    guideConnections: guideConnectionsByOrg.get(org.id) ?? [],
  }));

  return buildOrganizationRecords(rows);
}

/** Concise summary, for the Founder Digest -- but see
 *  app/api/cron/founder-digest/route.ts's own comment: this is only ever
 *  wired into the digest when getAllOrganizationRecords() actually returns
 *  rows, per the governing instruction's "only if real data exists." */
export type OrganizationOperationsSummary = {
  organizationsTotal: number;
  organizationsNeedingSetup: number;
  guideCoverageMismatches: number;
  ready: number;
};

export async function getOrganizationOperationsSummary(): Promise<{
  summary: OrganizationOperationsSummary;
  records: OrganizationRecord[];
}> {
  const records = await getAllOrganizationRecords();
  const summary: OrganizationOperationsSummary = {
    organizationsTotal: records.length,
    organizationsNeedingSetup: records.filter(
      (r) => r.operationalState === "no_admin_assigned" || r.operationalState === "no_guides_connected"
    ).length,
    guideCoverageMismatches: records.filter((r) => r.operationalState === "guide_coverage_mismatch").length,
    ready: records.filter((r) => r.operationalState === "ready").length,
  };
  return { summary, records };
}

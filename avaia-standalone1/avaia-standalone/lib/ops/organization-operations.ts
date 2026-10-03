import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildOrganizationRecords,
  type OrganizationAdminStatus,
  type OrganizationGuideConnection,
  type OrganizationGuideStatus,
  type OrganizationRecord,
} from "@/lib/organization-operations";
import { getAllGuideOperationsRecords } from "@/lib/ops/guide-access-operations";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// ORGANIZATION OPERATIONS, as an operational capability. One admin-client batched
// read of every organization with its administrator grants and connected Guides,
// the rules in lib/organization-operations.ts applied to each, and whatever needs
// a person routed to What Needs Dorian. It never changes a grant or a connection
// and reads nothing about any Host.

/** Every organization with its admin-grant statuses and connected-Guide validity
 *  resolved. Connected Guides' certification and authorization come from Guide
 *  Operations' own records (never re-derived, never waived here). */
export async function getAllOrganizationRecords(): Promise<OrganizationRecord[]> {
  const admin = createAdminClient();

  const [{ data: orgRows }, { data: adminRows }, { data: guideConnRows }] = await Promise.all([
    admin.from("organizations").select("id, name"),
    admin.from("organization_admins").select("organization_id, status"),
    admin.from("organization_guides").select("organization_id, guide_id, status").eq("status", "connected"),
  ]);

  const adminStatusesByOrg = new Map<string, OrganizationAdminStatus[]>();
  for (const row of (adminRows ?? []) as { organization_id: string; status: OrganizationAdminStatus }[]) {
    const list = adminStatusesByOrg.get(row.organization_id) ?? [];
    list.push(row.status);
    adminStatusesByOrg.set(row.organization_id, list);
  }

  const connRows = (guideConnRows ?? []) as { organization_id: string; guide_id: string; status: OrganizationGuideStatus }[];
  const guideOpsById = new Map((connRows.length ? await getAllGuideOperationsRecords() : []).map((g) => [g.hostId, g]));

  const connectionsByOrg = new Map<string, OrganizationGuideConnection[]>();
  for (const row of connRows) {
    const guideOps = guideOpsById.get(row.guide_id);
    const list = connectionsByOrg.get(row.organization_id) ?? [];
    list.push({
      guideId: row.guide_id,
      status: row.status,
      certificationActive: guideOps?.certificationStanding === "active",
      toolkitAuthorized: guideOps?.toolkitAuthorized === true,
    });
    connectionsByOrg.set(row.organization_id, list);
  }

  return buildOrganizationRecords(
    ((orgRows ?? []) as { id: string; name: string }[]).map((org) => ({
      organizationId: org.id,
      name: org.name,
      adminStatuses: adminStatusesByOrg.get(org.id) ?? [],
      guideConnections: connectionsByOrg.get(org.id) ?? [],
    }))
  );
}

/** Pure: turns records into the capability result. */
export function classifyOrganizations(records: OrganizationRecord[], guideLabel: (id: string) => string): CapabilityResult {
  const people: NeedsItem[] = [];
  const problems: NeedsItem[] = [];
  const watching: NeedsItem[] = [];

  for (const r of records) {
    const href = "/admin/organization-admins";
    if (r.operationalState === "no_admin_assigned") {
      people.push({
        key: `org:${r.organizationId}:no_admin`,
        text: `${r.name} has no organization administrator assigned, so no one there can manage its Guides or programs. Only you can authorize one.`,
        href,
      });
    }
    if (r.operationalState === "no_guides_connected") {
      watching.push({
        key: `org:${r.organizationId}:no_guides`,
        text: `${r.name} has an administrator but no connected Guides yet (its administrator connects them).`,
        href,
      });
    }
    for (const m of r.mismatches) {
      if (m.type === "duplicate_active_admin_grant") {
        watching.push({ key: `org:${r.organizationId}:duplicate_admin`, text: `${r.name}: ${m.detail}`, href });
      } else {
        problems.push({
          key: `org:${r.organizationId}:${m.type}:${m.guideId ?? problems.length}`,
          text: `${r.name}: ${guideLabel(m.guideId ?? "")} ${m.type === "connected_guide_not_certified" ? "is connected but does not currently have active certification standing." : "is connected but is not currently Toolkit-authorized."}`,
          href,
        });
      }
    }
  }
  return { key: "organization_operations", label: "Organization / Event Operations", evaluated: records.length, people, problems, watching };
}

export async function evaluateOrganizationOperations(): Promise<CapabilityResult> {
  const records = await getAllOrganizationRecords();
  const guideIds = records.flatMap((r) => r.mismatches.map((m) => m.guideId).filter((g): g is string => !!g));
  const label = await hostLabels(guideIds);
  return classifyOrganizations(records, label);
}

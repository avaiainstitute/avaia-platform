import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGuideOperationsRecords,
  latestAuthorizationByCapability,
  type CertificationStanding,
  type GuideOperationsRecord,
} from "@/lib/guide-operations";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// GUIDE OPERATIONS, as an operational capability. One admin-client batched read
// of the four records that describe a Guide's access, the rules in
// lib/guide-operations.ts applied to each, and whatever needs a person routed to
// What Needs Dorian (and so to the daily digest and /admin/today). It never
// changes a certification standing, a profile role, an authorization, or a
// Host-scoped grant: telling Dorian is its whole job.

/** The "footprint" set is every account that appears in ANY of the four source
 *  tables: a 'guide' role, a certification record (any standing), a platform
 *  authorization (any status, ever), or a currently active Host-scoped grant.
 *  Anyone in that union gets a record; everyone else has no Guide footprint. */
export async function getAllGuideOperationsRecords(): Promise<GuideOperationsRecord[]> {
  const admin = createAdminClient();

  const [{ data: guideRoleRows }, { data: certRows }, { data: authRows }, { data: journeyAccessRows }] = await Promise.all([
    admin.from("profiles").select("id, role").eq("role", "guide"),
    admin.from("guide_certifications").select("host_id, standing, certified_at"),
    admin.from("guide_platform_authorizations").select("host_id, capability, status, granted_at, status_changed_at"),
    admin.from("guide_journey_access").select("guide_id, revoked_at").is("revoked_at", null),
  ]);

  const certByHost = new Map(
    ((certRows ?? []) as { host_id: string; standing: string; certified_at: string }[]).map((r) => [r.host_id, r])
  );
  type AuthRow = { host_id: string; capability: "toolkit" | "guided_journey_facilitation"; status: "authorized" | "revoked"; granted_at: string; status_changed_at: string | null };
  const authByHost = new Map<string, AuthRow[]>();
  for (const row of (authRows ?? []) as AuthRow[]) {
    const list = authByHost.get(row.host_id) ?? [];
    list.push(row);
    authByHost.set(row.host_id, list);
  }
  const accessCountByGuide = new Map<string, number>();
  for (const row of (journeyAccessRows ?? []) as { guide_id: string }[]) {
    accessCountByGuide.set(row.guide_id, (accessCountByGuide.get(row.guide_id) ?? 0) + 1);
  }
  const roleGuideIds = new Set(((guideRoleRows ?? []) as { id: string }[]).map((r) => r.id));

  const footprint = new Set<string>([...roleGuideIds, ...certByHost.keys(), ...authByHost.keys(), ...accessCountByGuide.keys()]);
  if (footprint.size === 0) return [];

  // The role of every footprint account (an account in the footprint for another
  // reason can hold a role other than 'guide', which is itself informative).
  const { data: profileRows } = await admin.from("profiles").select("id, role").in("id", Array.from(footprint));
  const roleById = new Map(((profileRows ?? []) as { id: string; role: string | null }[]).map((p) => [p.id, p.role]));

  return buildGuideOperationsRecords(
    Array.from(footprint).map((hostId) => {
      const latest = latestAuthorizationByCapability(authByHost.get(hostId) ?? []);
      const cert = certByHost.get(hostId);
      return {
        hostId,
        profileRole: roleById.get(hostId) ?? null,
        certificationStanding: (cert?.standing as CertificationStanding) ?? null,
        certifiedAt: cert?.certified_at ?? null,
        toolkitAuthorized: latest.get("toolkit") === "authorized",
        journeyFacilitationAuthorized: latest.get("guided_journey_facilitation") === "authorized",
        activeHostScopedAccessCount: accessCountByGuide.get(hostId) ?? 0,
      };
    })
  );
}

/** Pure: turns records into the capability result. Separate from the read so the
 *  self-test can exercise exactly this with simulated records. */
export function classifyGuideOperations(records: GuideOperationsRecord[], label: (hostId: string) => string): CapabilityResult {
  const problems: NeedsItem[] = [];
  for (const r of records) {
    for (const m of r.mismatches) {
      problems.push({
        key: `guide:${r.hostId}:${m.type}:${problems.length}`,
        text: `Guide access mismatch -- ${label(r.hostId)}: ${m.detail}`,
        href: "/admin/guide-certifications",
      });
    }
  }
  return { key: "guide_operations", label: "Guide Operations", evaluated: records.length, problems };
}

export async function evaluateGuideOperations(): Promise<CapabilityResult> {
  const records = await getAllGuideOperationsRecords();
  const label = await hostLabels(records.filter((r) => r.humanActionRequired).map((r) => r.hostId));
  return classifyGuideOperations(records, label);
}

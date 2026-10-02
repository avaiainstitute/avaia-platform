import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGuideOperationsRecords,
  type GuideOperationsRecord,
  type GuideMismatch,
  type CertificationStanding,
} from "@/lib/guide-operations";

// Guide Operations Agent -- admin-client batched fetch + daily cron
// notification. Mirrors lib/ops/certification-operations.ts's own shape:
// one admin-client pass over the relevant tables, pure-function derivation
// (lib/guide-operations.ts), then a cooldown-gated sendFn loop that only
// ever notifies admin/ops and never changes guide_certifications.standing,
// profiles.role, or any authorization row itself.

const COOLDOWN_DAYS = Number(process.env.GUIDE_ACCESS_OPERATIONS_COOLDOWN_DAYS ?? 3);

/** The "candidate set" for this resolver is the union of every host who
 *  shows up in ANY of the four source tables -- role='guide', a
 *  certification record (any standing), a platform-authorization record
 *  (any status, ever), or a currently-active guide_journey_access grant.
 *  Anyone in that union gets a record; everyone else has no Guide
 *  Operations footprint at all and is correctly left out. */
export async function getAllGuideOperationsRecords(): Promise<GuideOperationsRecord[]> {
  const admin = createAdminClient();

  const [
    { data: guideRoleRows },
    { data: certRows },
    { data: authRows },
    { data: journeyAccessRows },
  ] = await Promise.all([
    admin.from("profiles").select("id, role").eq("role", "guide"),
    admin.from("guide_certifications").select("host_id, standing, certified_at"),
    admin.from("guide_platform_authorizations").select("host_id, capability, status, granted_at, status_changed_at"),
    admin.from("guide_journey_access").select("guide_id, revoked_at").is("revoked_at", null),
  ]);

  const guideRoleHostIds = new Set((guideRoleRows ?? []).map((r: { id: string }) => r.id));
  const certByHost = new Map(
    (certRows ?? []).map((r: { host_id: string; standing: string; certified_at: string }) => [r.host_id, r])
  );

  const authRowsTyped = (authRows ?? []) as {
    host_id: string;
    capability: "toolkit" | "guided_journey_facilitation";
    status: "authorized" | "revoked";
    granted_at: string;
    status_changed_at: string | null;
  }[];
  const latestAuthByHostCapability = new Map<string, "authorized" | "revoked">();
  const ts = (r: { granted_at: string; status_changed_at: string | null }) =>
    new Date(r.status_changed_at ?? r.granted_at).getTime();
  for (const row of [...authRowsTyped].sort((a, b) => ts(a) - ts(b))) {
    latestAuthByHostCapability.set(`${row.host_id}:${row.capability}`, row.status);
  }
  const authHostIds = new Set(authRowsTyped.map((r) => r.host_id));

  const activeHostScopedCountByGuide = new Map<string, number>();
  for (const row of (journeyAccessRows ?? []) as { guide_id: string }[]) {
    activeHostScopedCountByGuide.set(row.guide_id, (activeHostScopedCountByGuide.get(row.guide_id) ?? 0) + 1);
  }
  const journeyAccessHostIds = new Set(activeHostScopedCountByGuide.keys());

  const allHostIds = new Set<string>([
    ...guideRoleHostIds,
    ...certByHost.keys(),
    ...authHostIds,
    ...journeyAccessHostIds,
  ]);

  const hostIdList = [...allHostIds];
  const { data: roleRows } = hostIdList.length
    ? await admin.from("profiles").select("id, role").in("id", hostIdList)
    : { data: [] as { id: string; role: string | null }[] };
  const roleByHost = new Map((roleRows ?? []).map((r) => [r.id, r.role]));

  const rows = hostIdList.map((hostId) => {
    const cert = certByHost.get(hostId) as { standing: string; certified_at: string } | undefined;
    return {
      hostId,
      profileRole: roleByHost.get(hostId) ?? null,
      certificationStanding: (cert?.standing as CertificationStanding) ?? null,
      certifiedAt: cert?.certified_at ?? null,
      toolkitAuthorized: latestAuthByHostCapability.get(`${hostId}:toolkit`) === "authorized",
      journeyFacilitationAuthorized: latestAuthByHostCapability.get(`${hostId}:guided_journey_facilitation`) === "authorized",
      activeHostScopedAccessCount: activeHostScopedCountByGuide.get(hostId) ?? 0,
    };
  });

  return buildGuideOperationsRecords(rows);
}

/** Concise summary for the founder/ops digest -- counts only. */
export type GuideOperationsSummary = {
  activeGuides: number;
  pausedOrRevokedNeedingAction: number;
  permissionMismatches: number;
  incompleteHandoffs: number;
  failedAutomations: number;
};

export async function getGuideOperationsSummary(): Promise<{ summary: GuideOperationsSummary; records: GuideOperationsRecord[] }> {
  const records = await getAllGuideOperationsRecords();
  const summary: GuideOperationsSummary = {
    activeGuides: records.filter((r) => r.operationalState === "healthy").length,
    pausedOrRevokedNeedingAction: records.filter((r) => r.operationalState === "paused" || r.operationalState === "revoked").length,
    permissionMismatches: records.filter((r) => r.operationalState === "permission_mismatch").length,
    incompleteHandoffs: records.filter((r) => r.mismatches.some((m) => m.type === "incomplete_certification_handoff")).length,
    failedAutomations: records.filter(
      (r) => r.mismatches.some((m) => m.type === "paused_certification_active_access" || m.type === "revoked_certification_active_access")
    ).length,
  };
  return { summary, records };
}

export type GuideAccessNotification = { hostId: string; operationalState: GuideOperationsRecord["operationalState"]; mismatch: GuideMismatch };

/** Cron body -- same cooldown/idempotency shape as
 *  recordCertificationOperationsExceptions. One guide_access_exceptions row
 *  per (host, mismatch type) per notification, never repeated inside
 *  COOLDOWN_DAYS. sendFn is expected to notify admin/ops only -- this
 *  function never contacts a Guide or Host and never writes to any table
 *  other than guide_access_exceptions. */
export async function recordGuideAccessExceptions(
  sendFn: (n: GuideAccessNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const records = await getAllGuideOperationsRecords();

  let sent = 0;
  let skippedCooldown = 0;

  for (const record of records) {
    for (const mismatch of record.mismatches) {
      const { data: lastRow } = await admin
        .from("guide_access_exceptions")
        .select("sent_at")
        .eq("host_id", record.hostId)
        .eq("mismatch_type", mismatch.type)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRow) {
        const daysSince = (Date.now() - new Date(lastRow.sent_at).getTime()) / 86_400_000;
        if (daysSince < COOLDOWN_DAYS) {
          skippedCooldown += 1;
          continue;
        }
      }

      await sendFn({ hostId: record.hostId, operationalState: record.operationalState, mismatch });
      await admin.from("guide_access_exceptions").insert({
        host_id: record.hostId,
        mismatch_type: mismatch.type,
        detail: mismatch.detail,
        operational_state: record.operationalState,
      });
      sent += 1;
    }
  }

  return { sent, skippedCooldown };
}

import {
  getAllHostJourneyRecords,
  getAllGuideParticipantRecords,
  getHostScopedAccessStatuses,
} from "@/lib/ops/host-participant-operations";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Host / Participant Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Admin-facing Host / Participant Operations view -- extends the /admin
 *  area built for Certification Operations and Guide Operations. Shows
 *  operational exceptions only, never conversation content: every value
 *  here is a mechanical fact or a deterministic derivation from
 *  lib/host-operations.ts. Healthy Hosts and participants are summarized
 *  as counts, not listed individually, so exceptions don't get lost in a
 *  long healthy roster. This page never interprets what a Host meant,
 *  diagnoses, prescribes, or makes a safety judgment -- it surfaces
 *  mismatches for a human to act on. */
export default async function AdminHostParticipantOperationsPage() {
  const [hostRecords, participantRecords, accessStatuses] = await Promise.all([
    getAllHostJourneyRecords(),
    getAllGuideParticipantRecords(),
    getHostScopedAccessStatuses(),
  ]);

  const admin = createAdminClient();

  const blockedHosts = hostRecords.filter((r) => r.state === "continuation_blocked_by_entitlement");
  const mismatchedHosts = hostRecords.filter((r) => r.mismatches.length > 0 || r.state === "operational_mismatch");
  const notStartedHosts = hostRecords.filter((r) => r.state === "account_created_no_journey");
  const healthyHostCount = hostRecords.length - blockedHosts.length - mismatchedHosts.length - notStartedHosts.length;

  const mismatchedParticipants = participantRecords.filter((r) => r.state === "operational_mismatch");
  const healthyParticipantCount = participantRecords.length - mismatchedParticipants.length;

  const invalidAccess = accessStatuses.filter((a) => !a.valid);

  const flaggedHostIds = [
    ...new Set([...blockedHosts, ...mismatchedHosts].map((r) => r.hostId)),
  ];
  const { data: profileRows } = flaggedHostIds.length
    ? await admin.from("profiles").select("id, guide_display_name").in("id", flaggedHostIds)
    : { data: [] as { id: string; guide_display_name: string | null }[] };
  const nameByHostId = new Map((profileRows ?? []).map((p) => [p.id, p.guide_display_name]));

  return (
    <div>
      <p className="label mb-3">Host / Participant Operations</p>
      <h1 className="font-serif text-4xl text-ink">People Using AVAIA</h1>
      <p className="mt-4 text-lg text-muted">
        Operational logistics only -- entering AVAIA, reaching the correct session, returning to
        something already started, and deterministic membership/access mismatches. This page never
        interprets what a Host means, diagnoses, prescribes, or makes a safety judgment.
      </p>

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
        <p className="label mb-2 text-muted">At a glance</p>
        <p className="text-sm text-ink">
          {healthyHostCount} Host(s) progressing normally or journey-complete &middot; {notStartedHosts.length}{" "}
          account(s) created with no journey started yet &middot; {healthyParticipantCount} Guide-facilitated
          participant(s) ready or in session with no exception.
        </p>
      </section>

      {blockedHosts.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Blocked by Entitlement ({blockedHosts.length})</p>
          <div className="mt-3 space-y-3">
            {blockedHosts.map((r) => (
              <div key={r.hostId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-lg text-ink">{nameByHostId.get(r.hostId) ?? r.hostId}</p>
                <p className="mt-1 text-sm text-muted">
                  Current stage: {r.currentStage ?? "none"} &middot; Member: {r.isMember ? "yes" : "no"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {mismatchedHosts.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Human Review Required -- Host Mismatches ({mismatchedHosts.length})</p>
          <div className="mt-3 space-y-3">
            {mismatchedHosts.map((r) => (
              <div key={r.hostId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-lg text-ink">{nameByHostId.get(r.hostId) ?? r.hostId}</p>
                <p className="mt-1 text-sm text-muted">Operational state: {r.state}</p>
                {r.mismatches.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.mismatches.map((m, i) => (
                      <li key={i} className="text-sm text-ink">
                        <span className="font-semibold">{m.type}</span> -- {m.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {mismatchedParticipants.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Human Review Required -- Participant Mismatches ({mismatchedParticipants.length})</p>
          <div className="mt-3 space-y-3">
            {mismatchedParticipants.map((r) => (
              <div key={r.participantId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-lg text-ink">Participant {r.participantId}</p>
                <p className="mt-1 text-sm text-ink">{r.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {invalidAccess.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Invalid Host-Scoped Guide Access ({invalidAccess.length})</p>
          <div className="mt-3 space-y-3">
            {invalidAccess.map((a, i) => (
              <div key={i} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <p className="font-serif text-lg text-ink">{nameByHostId.get(a.guideId) ?? a.guideId}</p>
                <p className="mt-1 text-sm text-ink">{a.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blockedHosts.length === 0 &&
        mismatchedHosts.length === 0 &&
        mismatchedParticipants.length === 0 &&
        invalidAccess.length === 0 && (
          <p className="mt-10 text-muted">No operational exceptions on file right now.</p>
        )}
    </div>
  );
}

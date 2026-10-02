import { getAllGuideOperationsRecords } from "@/lib/ops/guide-access-operations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuideOperationsRecord, GuideOperationalState } from "@/lib/guide-operations";

export const metadata = { title: "Guide Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

const GROUP_ORDER: { state: GuideOperationalState; label: string }[] = [
  { state: "human_review_required", label: "Human Review Required" },
  { state: "revoked", label: "Revoked" },
  { state: "paused", label: "Paused" },
  { state: "permission_mismatch", label: "Permission Mismatch" },
  { state: "healthy", label: "Healthy" },
  { state: "not_certified", label: "Not Certified" },
];

/** Admin-facing Guide Operations view -- extends the /admin area built for
 *  Certification Operations. Reads only; every value is a mechanical fact
 *  or a deterministic derivation from lib/guide-operations.ts, never a
 *  judgment this page makes. It never decides certification, suspension,
 *  revocation, or authorization -- it surfaces what the existing records
 *  already say, for a human to act on. */
export default async function AdminGuideOperationsPage() {
  const records = await getAllGuideOperationsRecords();

  const admin = createAdminClient();
  const hostIds = records.map((r) => r.hostId);
  const { data: profileRows } = hostIds.length
    ? await admin.from("profiles").select("id, guide_display_name").in("id", hostIds)
    : { data: [] as { id: string; guide_display_name: string | null }[] };
  const nameByHostId = new Map((profileRows ?? []).map((p) => [p.id, p.guide_display_name]));

  const byState = new Map<GuideOperationalState, GuideOperationsRecord[]>();
  for (const r of records) {
    const arr = byState.get(r.operationalState) ?? [];
    arr.push(r);
    byState.set(r.operationalState, arr);
  }

  return (
    <div>
      <p className="label mb-3">Guide Operations</p>
      <h1 className="font-serif text-4xl text-ink">Certified Guides</h1>
      <p className="mt-4 text-lg text-muted">
        Keeps a Certified Guide&rsquo;s standing, platform permissions, Toolkit authorization, and
        Host-scoped access aligned with what AVAIA has actually granted. This page never decides
        certification, suspension, revocation, or authorization -- it surfaces mismatches for a
        human to act on.
      </p>

      {records.length === 0 && <p className="mt-12 text-muted">No Guide Operations records on file.</p>}

      {GROUP_ORDER.map(({ state, label }) => {
        const group = byState.get(state) ?? [];
        if (group.length === 0) return null;
        return (
          <section key={state} className="mt-10">
            <p className="label text-muted">
              {label} ({group.length})
            </p>
            <div className="mt-3 space-y-5">
              {group.map((r) => (
                <div key={r.hostId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-ink">{nameByHostId.get(r.hostId) ?? r.hostId}</p>
                    <span className="label text-muted">{r.certificationStanding ?? "no certification record"}</span>
                  </div>

                  <p className="mt-2 text-sm text-ink">
                    <span className="text-muted">Role: </span>
                    {r.profileRole ?? "none"}
                    <span className="text-muted"> &middot; Certified: </span>
                    {r.certifiedAt ? new Date(r.certifiedAt).toLocaleDateString() : "n/a"}
                  </p>

                  <p className="mt-1 text-sm text-muted">
                    Toolkit authorization: {r.toolkitAuthorized ? "authorized" : "not authorized"} &middot; Guided
                    Journey Facilitation: {r.journeyFacilitationAuthorized ? "authorized" : "not authorized"} &middot;{" "}
                    {r.activeHostScopedAccessCount} active Host-scoped relationship(s)
                  </p>

                  {r.mismatches.length > 0 && (
                    <div className="mt-3 border-t border-rule pt-3">
                      <p className="label text-muted">Mismatches</p>
                      <ul className="mt-1 space-y-1">
                        {r.mismatches.map((m, i) => (
                          <li key={i} className="text-sm text-ink">
                            <span className="font-semibold">{m.type}</span> -- {m.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

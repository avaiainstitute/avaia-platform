import { getAllOrganizationRecords } from "@/lib/ops/organization-operations";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganizationRecord, OrganizationOperationalState } from "@/lib/organization-operations";

export const metadata = { title: "Organization / Event Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

const GROUP_ORDER: { state: OrganizationOperationalState; label: string }[] = [
  { state: "guide_coverage_mismatch", label: "Guide Coverage Mismatch" },
  { state: "operational_mismatch", label: "Operational Mismatch" },
  { state: "no_admin_assigned", label: "No Admin Assigned" },
  { state: "no_guides_connected", label: "No Guides Connected" },
];

/** Admin-facing Organization / Event Operations view -- extends the
 *  /admin area built for Certification, Guide, and Host/Participant
 *  Operations. Audit finding this page is built against: `organizations`,
 *  `organization_admins`, and `organization_guides` exist in schema with
 *  full RLS already designed, but have zero rows and zero other
 *  application code references today -- there is no event, registration,
 *  roster, or attendance infrastructure at all. This page is therefore
 *  read-only organization/Guide-coverage logistics only; it does not (and
 *  cannot truthfully) show an event-instance lifecycle, a roster, or
 *  attendance, because none of those records exist yet. Ready organizations
 *  are summarized as a count, never listed individually -- the same
 *  exceptions-first posture as every other Operations admin page. */
export default async function AdminOrganizationOperationsPage() {
  const records = await getAllOrganizationRecords();

  const admin = createAdminClient();
  const orgIds = records.map((r) => r.organizationId);
  const { data: orgRows } = orgIds.length
    ? await admin.from("organizations").select("id, name, org_type, contact_name, contact_email").in("id", orgIds)
    : { data: [] as { id: string; name: string; org_type: string | null; contact_name: string | null; contact_email: string | null }[] };
  const orgById = new Map((orgRows ?? []).map((o) => [o.id, o]));

  const byState = new Map<OrganizationOperationalState, OrganizationRecord[]>();
  for (const r of records) {
    const arr = byState.get(r.operationalState) ?? [];
    arr.push(r);
    byState.set(r.operationalState, arr);
  }
  const readyCount = byState.get("ready")?.length ?? 0;

  return (
    <div>
      <p className="label mb-3">Organization / Event Operations</p>
      <h1 className="font-serif text-4xl text-ink">Organizations</h1>
      <p className="mt-4 text-lg text-muted">
        Operational logistics for AVAIA Experiences delivered to groups and organizations --
        organization setup, admin contact, and connected-Guide coverage only. This page never
        exposes or analyzes private participant conversations, and never becomes the Guide.
      </p>

      {records.length === 0 && (
        <p className="mt-12 text-muted">
          No organizations on file. The schema and access model for Organization / Event
          Operations are in place (see the governing audit), but no organization record has been
          created yet, and no event, registration, roster, or attendance infrastructure currently
          exists to build further logistics on top of.
        </p>
      )}

      {records.length > 0 && (
        <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
          <p className="label mb-2 text-muted">At a glance</p>
          <p className="text-sm text-ink">{readyCount} organization(s) ready, with an authorized admin and fully valid Guide coverage.</p>
        </section>
      )}

      {GROUP_ORDER.map(({ state, label }) => {
        const group = byState.get(state) ?? [];
        if (group.length === 0) return null;
        return (
          <section key={state} className="mt-10">
            <p className="label text-muted">
              {label} ({group.length})
            </p>
            <div className="mt-3 space-y-5">
              {group.map((r) => {
                const org = orgById.get(r.organizationId);
                return (
                  <div key={r.organizationId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-serif text-lg text-ink">{org?.name ?? r.organizationId}</p>
                      <span className="label text-muted">{org?.org_type ?? "type unknown"}</span>
                    </div>
                    <p className="mt-2 text-sm text-ink">
                      <span className="text-muted">Admin contact: </span>
                      {org?.contact_name ?? "none on file"}
                      {org?.contact_email ? ` (${org.contact_email})` : ""}
                      <span className="text-muted"> &middot; Authorized admin grant: </span>
                      {r.hasAuthorizedAdmin ? "yes" : "no"}
                    </p>
                    <p className="mt-1 text-sm text-muted">{r.connectedGuides.length} connected Guide(s).</p>
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
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

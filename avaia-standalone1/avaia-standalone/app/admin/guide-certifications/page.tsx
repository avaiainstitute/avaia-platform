import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAllStatuses,
  formatDateLabel,
  LIFECYCLE_LABEL,
  type CertificationStatus,
  type LifecycleState,
} from "@/lib/certification-renewal";

export const metadata = { title: "Guide Certifications, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Renewal / continuing education / inactive status for every Certified
// Guide. Read-only overview; every action (confirm renewal, record CE,
// record a fee, reactivate) happens on the per-certification page and is a
// human decision. Reads use the signed-in admin's own RLS-bound client
// (admin-all policies, migration 0082); the service-role client is used
// only to turn Host ids into emails for display, behind the same admin
// check every other admin page uses.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-certifications");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return supabase;
}

async function resolveEmailsByHostId(hostIds: string[]): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const remaining = new Set(hostIds);
  if (remaining.size === 0) return emailById;
  const admin = createAdminClient();
  for (let page = 1; page <= 20 && remaining.size > 0; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email && remaining.has(u.id)) {
        emailById.set(u.id, u.email);
        remaining.delete(u.id);
      }
    }
    if (data.users.length < 1000) break;
  }
  return emailById;
}

// Most urgent first: things that need a human, then lapsing, then healthy.
const LIFECYCLE_ORDER: LifecycleState[] = [
  "renewal_ready_awaiting_confirmation",
  "lapse_pending",
  "recertification_required",
  "inactive_reactivatable",
  "active",
  "paused",
  "revoked",
];

const GROUP_HINT: Partial<Record<LifecycleState, string>> = {
  renewal_ready_awaiting_confirmation: "Everything is complete. Waiting only for you to confirm the renewal.",
  lapse_pending: "The period has ended and requirements are not met. The next daily run marks these inactive.",
  recertification_required: "Inactive for the full reactivation window. Only the AVAIA certification process can restore these.",
  inactive_reactivatable: "Inactive, still inside the reactivation window.",
};

function CertRow({ s, email }: { s: CertificationStatus; email: string | undefined }) {
  return (
    <Link
      href={`/admin/guide-certifications/${s.certificationId}`}
      className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm transition-colors hover:border-seal/60"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-ink">{email ?? s.hostId}</span>
        <span className="text-muted">
          {s.standing === "inactive" && s.inactivity
            ? `Inactive ${s.inactivity.monthsInactive} month${s.inactivity.monthsInactive === 1 ? "" : "s"}`
            : s.cycleEndsAt
              ? `Period ends ${formatDateLabel(s.cycleEndsAt)}${
                  s.daysRemaining !== null && s.daysRemaining > 0 ? ` (${s.daysRemaining} days)` : ""
                }`
              : "No cycle dates"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        CE {s.ce.approvedInPeriod} of {s.ce.requiredCredits}
        {s.ce.pendingInPeriod > 0 ? ` (+${s.ce.pendingInPeriod} awaiting approval)` : ""}
        {" · "}Ethics {s.ethics.currentNow ? "current" : s.ethics.state === "overdue" ? "overdue" : "due"}
        {" · "}Fee {s.payment.status === "not_determined" ? "not determined" : s.payment.status}
      </p>
    </Link>
  );
}

export default async function AdminGuideCertificationsPage() {
  const supabase = await requireAdmin();
  const statuses = await loadAllStatuses(supabase);
  const emailById = await resolveEmailsByHostId(Array.from(new Set(statuses.map((s) => s.hostId))));

  const groups = LIFECYCLE_ORDER.map((state) => ({
    state,
    rows: statuses
      .filter((s) => s.lifecycle === state)
      .sort((a, b) => (a.cycleEndsAt ?? "").localeCompare(b.cycleEndsAt ?? "")),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Guide Certifications</h1>
      <p className="mt-4 text-lg text-muted">
        Each Guide has their own rolling 365-day period. Renewal needs 24 approved continuing education
        credits, the annual fee, current Ethics, and good standing, and you confirm every renewal. Nothing
        here is ever renewed, reactivated, or recertified automatically.
      </p>

      {statuses.length === 0 ? (
        <p className="mt-10 text-muted">
          No certifications to show. If Guides are certified, apply migration 0082 first.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.state} className="rule-t mt-12 border-t border-rule pt-8">
            <p className="label mb-1 text-muted">
              {LIFECYCLE_LABEL[g.state]} ({g.rows.length})
            </p>
            {GROUP_HINT[g.state] && <p className="mb-4 text-sm text-muted">{GROUP_HINT[g.state]}</p>}
            <div className="space-y-2">
              {g.rows.map((s) => (
                <CertRow key={s.certificationId} s={s} email={emailById.get(s.hostId)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

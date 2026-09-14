import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Inquiries, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Automation audit finding #4.1/#4.2: contact_submissions and the two Pink
// Shoelace tables have status/resolved_at columns (0063) that nothing ever
// wrote, so a flagged inquiry repeated in the founder digest every day
// forever with no way to clear it except a raw Supabase edit. This page is
// the smallest usable fix: list what's open, let an admin mark it
// acknowledged/resolved. Not a CRM -- no notes, no assignment, no pipeline
// stages beyond the four statuses these tables already had.
//
// All three tables have RLS enabled with zero policies (service-role only,
// same posture as guide_candidates' original design before its own
// admin-all policy existed) -- there is no policy that would let even an
// admin-authenticated session read these through its own RLS-scoped
// client, so every read/write below deliberately uses the service-role
// admin client, exactly like lib/family-membership.ts's own documented
// reason for doing the same. The page's own role check (profiles.role ===
// 'admin') is therefore the real enforcement point, re-verified on every
// request rather than trusted from how the page was reached.

type Source = "contact_submissions" | "pink_contact_submissions" | "pink_participation_interest";
const SOURCES: Source[] = ["contact_submissions", "pink_contact_submissions", "pink_participation_interest"];
const SOURCE_LABEL: Record<Source, string> = {
  contact_submissions: "AVAIA Contact",
  pink_contact_submissions: "Pink Shoelace Contact",
  pink_participation_interest: "Pink Shoelace Participation Interest",
};

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/inquiries");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return user.id;
}

async function updateInquiryStatus(formData: FormData) {
  "use server";
  await requireAdmin();

  const source = String(formData.get("source") ?? "") as Source;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!SOURCES.includes(source) || !id || !["acknowledged", "resolved", "new"].includes(status)) {
    redirect("/admin/inquiries?error=invalid_update");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from(source)
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      follow_up_needed: status === "resolved" ? false : undefined,
    })
    .eq("id", id);

  if (error) redirect("/admin/inquiries?error=update_failed");
  redirect("/admin/inquiries?updated=1");
}

type Row = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  needs_dorian: boolean;
  detail: string;
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string };
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: contactRows }, { data: pinkContactRows }, { data: pinkParticipationRows }] = await Promise.all([
    admin
      .from("contact_submissions")
      .select("id, name, reason, message, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false }),
    admin
      .from("pink_contact_submissions")
      .select("id, name, category, message, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false }),
    admin
      .from("pink_participation_interest")
      .select("id, name, interest_type, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false }),
  ]);

  const bySource: Record<Source, Row[]> = {
    contact_submissions: ((contactRows ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: `${r.reason} -- ${String(r.message).slice(0, 140)}`,
    })),
    pink_contact_submissions: ((pinkContactRows ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: `${r.category} -- ${String(r.message).slice(0, 140)}`,
    })),
    pink_participation_interest: ((pinkParticipationRows ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: r.interest_type,
    })),
  };

  const totalOpen = SOURCES.reduce((n, s) => n + bySource[s].length, 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Inquiries</h1>
      <p className="mt-4 text-muted">
        Every open (not yet resolved) AVAIA and Pink Shoelace form submission, {totalOpen} total. Marking
        something resolved here is the only thing that stops it repeating in the daily founder digest.
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Couldn&rsquo;t update that item. Please try again.
        </p>
      )}
      {searchParams.updated && (
        <p className="mt-4 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-ink">Updated.</p>
      )}

      {SOURCES.map((source) => (
        <section key={source} className="rule-t mt-12 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">
            {SOURCE_LABEL[source]} ({bySource[source].length})
          </p>
          {bySource[source].length === 0 ? (
            <p className="text-sm text-muted">Nothing open.</p>
          ) : (
            <div className="space-y-3">
              {bySource[source].map((row) => (
                <div key={row.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-serif text-lg text-ink">{row.name}</p>
                    <span className="label shrink-0 text-muted">
                      {row.status}
                      {row.needs_dorian ? " -- needs review" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{row.detail}</p>
                  <p className="mt-1 text-xs text-muted">{new Date(row.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex gap-2">
                    {row.status !== "acknowledged" && (
                      <form action={updateInquiryStatus}>
                        <input type="hidden" name="source" value={source} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="acknowledged" />
                        <button
                          type="submit"
                          className="rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink hover:border-seal"
                        >
                          Mark acknowledged
                        </button>
                      </form>
                    )}
                    <form action={updateInquiryStatus}>
                      <input type="hidden" name="source" value={source} />
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="status" value="resolved" />
                      <button
                        type="submit"
                        className="rounded-md bg-seal px-3 py-1.5 text-xs font-semibold text-[#05060b] hover:opacity-90"
                      >
                        Mark resolved
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <p className="mt-12 text-xs text-muted">
        <Link href="/admin/guide-candidates" className="underline hover:text-seal">
          Guide candidates
        </Link>
      </p>
    </div>
  );
}

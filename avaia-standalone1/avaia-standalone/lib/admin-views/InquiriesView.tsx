import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCOPE_BASE, SCOPE_TITLE, parseScope, type AdminScope } from "@/lib/admin-scope";

// Inquiries: what is open in the contact forms, shown for exactly ONE
// organization at a time. AVAIA's admin shows AVAIA's form; the Pink Shoelace
// Foundation's admin shows Pink Shoelace's two forms. The same page code serves
// both until Pink moves to its own project (Stage 2 of the separation), but a
// screen never mixes them.
//
// Automation audit finding #4.1/#4.2: these tables have status/resolved_at
// columns (0063) that nothing ever wrote, so a flagged inquiry repeated in the
// digest every day forever. This page lists what's open and lets an admin mark
// it acknowledged/resolved. Not a CRM.
//
// All tables have RLS enabled with zero policies (service-role only), so every
// read/write deliberately uses the service-role admin client; the page's own
// role check (profiles.role === 'admin') is the real enforcement point,
// re-verified on every request and on every action.

type Source = "contact_submissions" | "pink_contact_submissions" | "pink_participation_interest";

const SOURCES_BY_SCOPE: Record<AdminScope, Source[]> = {
  avaia: ["contact_submissions"],
  pink: ["pink_contact_submissions", "pink_participation_interest"],
};
const SOURCE_LABEL: Record<Source, string> = {
  contact_submissions: "AVAIA Contact",
  pink_contact_submissions: "Pink Shoelace Contact",
  pink_participation_interest: "Pink Shoelace Participation Interest",
};

async function requireAdmin(scope: AdminScope) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=${SCOPE_BASE[scope]}/inquiries`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return user.id;
}

async function updateInquiryStatus(formData: FormData) {
  "use server";
  const scope = parseScope(formData.get("scope"));
  const base = SCOPE_BASE[scope];
  await requireAdmin(scope);

  const source = String(formData.get("source") ?? "") as Source;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  // A scope may only touch its own organization's tables.
  if (!SOURCES_BY_SCOPE[scope].includes(source) || !id || !["acknowledged", "resolved", "new"].includes(status)) {
    redirect(`${base}/inquiries?error=invalid_update`);
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

  if (error) redirect(`${base}/inquiries?error=update_failed`);
  redirect(`${base}/inquiries?updated=1`);
}

type Row = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  needs_dorian: boolean;
  detail: string;
};

export default async function InquiriesView({
  scope,
  searchParams,
}: {
  scope: AdminScope;
  searchParams: { error?: string; updated?: string };
}) {
  await requireAdmin(scope);
  const admin = createAdminClient();
  const sources = SOURCES_BY_SCOPE[scope];

  const bySource: Partial<Record<Source, Row[]>> = {};
  if (sources.includes("contact_submissions")) {
    const { data } = await admin
      .from("contact_submissions")
      .select("id, name, reason, message, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false });
    bySource.contact_submissions = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: `${r.reason} -- ${String(r.message).slice(0, 140)}`,
    }));
  }
  if (sources.includes("pink_contact_submissions")) {
    const { data } = await admin
      .from("pink_contact_submissions")
      .select("id, name, category, message, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false });
    bySource.pink_contact_submissions = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: `${r.category} -- ${String(r.message).slice(0, 140)}`,
    }));
  }
  if (sources.includes("pink_participation_interest")) {
    const { data } = await admin
      .from("pink_participation_interest")
      .select("id, name, interest_type, created_at, status, needs_dorian")
      .neq("status", "resolved")
      .order("created_at", { ascending: false });
    bySource.pink_participation_interest = ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      status: r.status,
      needs_dorian: r.needs_dorian,
      detail: r.interest_type,
    }));
  }

  const totalOpen = sources.reduce((n, s) => n + (bySource[s]?.length ?? 0), 0);
  const organization = scope === "pink" ? "Pink Shoelace" : "AVAIA";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">{SCOPE_TITLE[scope]}</p>
      <h1 className="font-serif text-4xl text-ink">Inquiries</h1>
      <p className="mt-4 text-muted">
        Every open (not yet resolved) {organization} form submission, {totalOpen} total. Marking something resolved
        here is the only thing that stops it repeating in the daily summary.
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Couldn&rsquo;t update that item. Please try again.
        </p>
      )}
      {searchParams.updated && (
        <p className="mt-4 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-ink">Updated.</p>
      )}

      {sources.map((source) => {
        const rows = bySource[source] ?? [];
        return (
          <section key={source} className="rule-t mt-12 border-t border-rule pt-8">
            <p className="label mb-3 text-muted">
              {SOURCE_LABEL[source]} ({rows.length})
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted">Nothing open.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
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
                          <input type="hidden" name="scope" value={scope} />
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
                        <input type="hidden" name="scope" value={scope} />
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
        );
      })}

      <p className="mt-12 text-xs text-muted">
        <Link href={SCOPE_BASE[scope]} className="underline hover:text-seal">
          Back to {SCOPE_TITLE[scope]}
        </Link>
      </p>
    </div>
  );
}

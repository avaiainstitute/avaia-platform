import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Inquiries: what is open in AVAIA's contact form.
//
// Automation audit finding #4.1/#4.2: this table has status/resolved_at columns (0063) that
// nothing ever wrote, so a flagged inquiry repeated in the digest every day forever. This page
// lists what's open and lets an admin mark it acknowledged/resolved. Not a CRM.
//
// The table has RLS enabled with zero policies (service-role only), so every read/write
// deliberately uses the service-role admin client; the page's own role check
// (profiles.role === 'admin') is the real enforcement point, re-verified on every request and
// on every action.

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

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["acknowledged", "resolved", "new"].includes(status)) {
    redirect("/admin/inquiries?error=invalid_update");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("contact_submissions")
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

export default async function InquiriesView({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string };
}) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("contact_submissions")
    .select("id, name, reason, message, created_at, status, needs_dorian")
    .neq("status", "resolved")
    .order("created_at", { ascending: false });
  const rows: Row[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    status: r.status,
    needs_dorian: r.needs_dorian,
    detail: `${r.reason} -- ${String(r.message).slice(0, 140)}`,
  }));

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Inquiries</h1>
      <p className="mt-4 text-muted">
        Every open (not yet resolved) AVAIA form submission, {rows.length} total. Marking something resolved
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

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">AVAIA Contact ({rows.length})</p>
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

      <p className="mt-12 text-xs text-muted">
        <Link href="/admin" className="underline hover:text-seal">
          Back to AVAIA Admin
        </Link>
      </p>
    </div>
  );
}

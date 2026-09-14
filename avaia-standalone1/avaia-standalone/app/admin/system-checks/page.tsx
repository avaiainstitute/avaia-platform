import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSystemChecks, type CheckCategory, type CheckStatus } from "@/lib/ops/system-checks";

export const metadata = { title: "System Checks, AVAIA Admin" };
export const dynamic = "force-dynamic";

// Website Watcher, Journey Watcher, Shared Room Operations Watcher, Launch
// Readiness, and Testing/QC (Round 4) -- one shared view, since Dorian
// asked these to connect rather than duplicate each other. Same
// admin-role-gated-then-service-role posture as every other Round 3/4
// admin page.

const CATEGORY_LABEL: Record<CheckCategory, string> = {
  website: "Website Watcher",
  quality: "Testing / Quality Control",
  journey: "Journey Watcher",
  shared_room: "Shared Room Operations Watcher",
  launch_readiness: "Launch Readiness",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "PASS",
  problem: "PROBLEM",
  needs_dorian: "NEEDS DORIAN",
};

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/system-checks");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
}

async function runNow() {
  "use server";
  await requireAdmin();
  await runSystemChecks();
  redirect("/admin/system-checks?ran=1");
}

export default async function AdminSystemChecksPage({
  searchParams,
}: {
  searchParams: { ran?: string };
}) {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: latestRun } = await admin
    .from("system_check_results")
    .select("run_id, checked_at")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: rows } = latestRun
    ? await admin
        .from("system_check_results")
        .select("category, check_key, label, status, detail, checked_at")
        .eq("run_id", latestRun.run_id)
        .order("category", { ascending: true })
    : { data: [] };

  const byCategory = new Map<CheckCategory, typeof rows>();
  for (const r of rows ?? []) {
    const list = byCategory.get(r.category as CheckCategory) ?? [];
    list.push(r);
    byCategory.set(r.category as CheckCategory, list as any);
  }

  const order: CheckCategory[] = ["launch_readiness", "website", "quality", "journey", "shared_room"];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA + Pink Shoelace Admin</p>
      <h1 className="font-serif text-4xl text-ink">System Checks</h1>
      <p className="mt-4 text-lg text-muted">
        Website Watcher, Journey Watcher, Shared Room Operations Watcher, Launch Readiness, and
        Testing/QC, in one place so they never require checking five separate systems. Every check
        here is read-only -- nothing is ever submitted, emailed, or changed by running these. No
        private Host, Workbook, Unsung Heroes, or Shared Room conversation content is ever read.
      </p>

      {searchParams?.ran && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Checks ran just now.
        </p>
      )}

      <form action={runNow} className="mt-8">
        <button
          type="submit"
          className="rounded-md bg-seal px-5 py-2.5 text-sm font-semibold text-[#05060b] hover:opacity-90"
        >
          Run checks now
        </button>
      </form>

      {!latestRun ? (
        <p className="mt-10 text-muted">No checks have run yet -- run them now, or wait for the scheduled run.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted">
            Last run: {new Date(latestRun.checked_at).toLocaleString()}
          </p>
          {order.map((cat) => {
            const items = byCategory.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat} className="rule-t mt-10 border-t border-rule pt-6">
                <p className="label mb-3 text-muted">{CATEGORY_LABEL[cat]}</p>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div
                      key={r.check_key}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3"
                    >
                      <div>
                        <p className="text-ink">{r.label}</p>
                        {r.detail && <p className="mt-1 text-xs text-muted">{r.detail}</p>}
                      </div>
                      <span
                        className={`label ${r.status === "pass" ? "text-seal" : r.status === "problem" ? "text-[#e0857d]" : "text-[#e0c07d]"}`}
                      >
                        {STATUS_LABEL[r.status as CheckStatus]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

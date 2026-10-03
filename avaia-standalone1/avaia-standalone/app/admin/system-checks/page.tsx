import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSystemChecks, type CheckCategory, type CheckStatus } from "@/lib/ops/system-checks";

export const metadata = { title: "System Checks, AVAIA Admin" };
export const dynamic = "force-dynamic";
// "Run checks now" makes a few dozen small probes; give it room to finish.
export const maxDuration = 30;

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

  // The "AVAIA tells the truth about itself" checks (lib/ops/system-truth.ts)
  // are stored under the existing Testing/QC category and told apart by their
  // key prefix, so they can be shown as their own readable sections.
  type Row = { check_key: string; label: string; status: string; detail: string | null };
  // Pink Shoelace Foundation checks are shown in the Pink Shoelace Foundation admin, not here.
  const notPink = (r: Row) => !r.check_key.startsWith("pink_");
  const qualityRows = ((byCategory.get("quality") ?? []) as unknown as Row[]).filter(notPink);
  const withPrefix = (prefix: string) => qualityRows.filter((r) => r.check_key.startsWith(prefix));
  const otherQuality = qualityRows.filter((r) => !/^(schema_|schedule_|deploy_|pipeline_|capability_)/.test(r.check_key));
  const sections: { key: string; label: string; items: Row[] }[] = [
    { key: "launch_readiness", label: CATEGORY_LABEL.launch_readiness, items: (byCategory.get("launch_readiness") ?? []) as unknown as Row[] },
    { key: "truth_db", label: "Database: is everything the app needs really there?", items: withPrefix("schema_") },
    { key: "truth_jobs", label: "Scheduled jobs: are they running?", items: withPrefix("schedule_") },
    { key: "truth_deploy", label: "Deployment: is the latest version live and configured?", items: withPrefix("deploy_") },
    { key: "truth_pipeline", label: "Needs Dorian: does the pipeline behave as designed?", items: withPrefix("pipeline_") },
    { key: "truth_capabilities", label: "Operational capabilities: is each one actually operating?", items: withPrefix("capability_") },
    { key: "website", label: CATEGORY_LABEL.website, items: ((byCategory.get("website") ?? []) as unknown as Row[]).filter(notPink) },
    { key: "quality", label: CATEGORY_LABEL.quality, items: otherQuality },
    { key: "journey", label: CATEGORY_LABEL.journey, items: (byCategory.get("journey") ?? []) as unknown as Row[] },
    { key: "shared_room", label: CATEGORY_LABEL.shared_room, items: (byCategory.get("shared_room") ?? []) as unknown as Row[] },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
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
          {sections.map((section) => {
            const items = section.items;
            if (items.length === 0) return null;
            return (
              <section key={section.key} className="rule-t mt-10 border-t border-rule pt-6">
                <p className="label mb-3 text-muted">{section.label}</p>
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

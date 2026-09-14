import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CronName = "host-onboarding" | "guide-operations" | "founder-digest";

const EXPECTED_CRONS: CronName[] = ["host-onboarding", "guide-operations", "founder-digest"];

/** Records one cron invocation's outcome. Never throws -- a failure to
 *  record must not take down a cron whose actual work already succeeded;
 *  it only means that one run's visibility is lost, logged via
 *  console.error same as everything else in this codebase. */
export async function recordCronRun(params: {
  cronName: CronName;
  startedAt: Date;
  status: "success" | "partial" | "error";
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("cron_runs").insert({
      cron_name: params.cronName,
      started_at: params.startedAt.toISOString(),
      status: params.status,
      detail: params.detail ?? null,
    });
  } catch (err) {
    console.error("[cron-runs] failed to record cron run", {
      cronName: params.cronName,
      error: err instanceof Error ? err.message : err,
    });
  }
}

/** Surfaces two kinds of problem for the founder digest: a cron that ran
 *  and errored recently, and a cron with no recorded run at all in the last
 *  36 hours (missed its daily schedule -- e.g. CRON_SECRET misconfigured,
 *  or the route failing before it can record anything).
 *
 *  Known blind spot, stated plainly rather than glossed over: if
 *  founder-digest itself never runs, there is nothing here to notice it --
 *  this table only helps once at least one cron in the trio is still
 *  running to read it. It does not replace an external uptime monitor. */
export async function getCronHealthIssues(): Promise<string[]> {
  const admin = createAdminClient();
  const since48h = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const since36h = new Date(Date.now() - 36 * 3_600_000).getTime();

  const { data } = await admin
    .from("cron_runs")
    .select("cron_name, started_at, status")
    .gte("started_at", since48h)
    .order("started_at", { ascending: false });

  const rows = (data ?? []) as { cron_name: CronName; started_at: string; status: string }[];
  const issues: string[] = [];

  for (const name of EXPECTED_CRONS) {
    const mostRecent = rows.find((r) => r.cron_name === name);
    if (!mostRecent || new Date(mostRecent.started_at).getTime() < since36h) {
      issues.push(
        `Cron "${name}" has no recorded run in the last 36 hours -- check Vercel's Cron Jobs dashboard and CRON_SECRET.`
      );
    } else if (mostRecent.status === "error") {
      issues.push(`Cron "${name}" errored on its most recent run.`);
    } else if (mostRecent.status === "partial") {
      issues.push(`Cron "${name}" completed its most recent run with some items failing to send.`);
    }
  }
  return issues;
}

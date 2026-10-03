import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { runSystemChecks } from "@/lib/ops/system-checks";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The run makes a few dozen small database and network probes (see
// lib/ops/system-checks.ts and system-truth.ts); give it room to finish.
export const maxDuration = 30;

// Website Watcher + Journey Watcher + Shared Room Operations Watcher +
// Launch Readiness + Testing/QC (Round 4, Automation Blueprint), plus the
// "AVAIA tells the truth about itself" checks: database schema, scheduled
// jobs, and deployment. Runs every few hours; silent when everything is fine
// (see lib/ops/system-checks.ts) -- results are only ever surfaced through the
// Founder Digest / command center, never as their own separate alert
// stream Dorian has to check.

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    const { runId, results, launchReadiness } = await runSystemChecks();
    const problems = results.filter((r) => r.status !== "pass").length;
    // The job itself ran fine even when it found problems; "success" here
    // means the checks completed, the findings are in system_check_results.
    await recordCronRun({ cronName: "system-checks", startedAt, status: "success", detail: { checked: results.length, problems } });
    return NextResponse.json({
      ok: true,
      runId,
      checked: results.length,
      problems,
      launchReadiness,
    });
  } catch (e) {
    console.error("System checks cron: failed:", e);
    await recordCronRun({
      cronName: "system-checks",
      startedAt,
      status: "error",
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
    return NextResponse.json({ ok: false, error: "system_checks_failed" }, { status: 500 });
  }
}

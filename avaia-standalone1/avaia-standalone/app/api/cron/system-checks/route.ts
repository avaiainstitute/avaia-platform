import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { runSystemChecks } from "@/lib/ops/system-checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Website Watcher + Journey Watcher + Shared Room Operations Watcher +
// Launch Readiness + Testing/QC (Round 4, Automation Blueprint). Runs
// every few hours; silent when everything is fine (see
// lib/ops/system-checks.ts) -- results are only ever surfaced through the
// Founder Digest / command center, never as their own separate alert
// stream Dorian has to check.

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId, results, launchReadiness } = await runSystemChecks();
    return NextResponse.json({
      ok: true,
      runId,
      checked: results.length,
      problems: results.filter((r) => r.status !== "pass").length,
      launchReadiness,
    });
  } catch (e) {
    console.error("System checks cron: failed:", e);
    return NextResponse.json({ ok: false, error: "system_checks_failed" }, { status: 500 });
  }
}

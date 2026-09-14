import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { runEntitlementReconciliation } from "@/lib/ops/entitlement-reconciliation";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Automation audit finding #2.4 (Stripe <-> entitlements reconciliation).
// See lib/ops/entitlement-reconciliation.ts for the full detection/
// correction rules. This route only wraps that in cron auth + run
// recording, same shape as every other cron route in this codebase.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    const result = await runEntitlementReconciliation();
    const hasUncorrectedFailure = result.findings.some((f) => !f.corrected && f.correctionError);
    await recordCronRun({
      cronName: "entitlement-reconciliation",
      startedAt,
      status: hasUncorrectedFailure ? "partial" : "success",
      detail: { ...result },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "entitlement-reconciliation",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Entitlement reconciliation failed." }, { status: 500 });
  }
}

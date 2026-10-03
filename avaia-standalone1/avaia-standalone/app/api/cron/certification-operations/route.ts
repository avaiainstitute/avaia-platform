import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordCertificationOperationsExceptions } from "@/lib/ops/certification-operations";
import { sendEmail } from "@/lib/resend";
import { certificationOperationsExceptionEmailHtml } from "@/lib/ops/emails";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Certification Operations Agent, scheduled daily. Never emails a
// candidate: it notifies admin/ops only, of purely mechanical facts already
// computed by lib/certification-operations.ts (stale workflows, missing
// records, candidates ready for a human action, incomplete post-decision
// handoffs). It never evaluates competency, grades a Boundary Gate or
// Practicum, decides Critical Fail, certifies, admits, or changes standing.
// Idempotent via recordCertificationOperationsExceptions's own cooldown.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const notifyTo = process.env.CERTIFICATION_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  try {
    const result = await recordCertificationOperationsExceptions(async (n) => {
      if (!notifyTo) return; // Nothing configured to notify yet; still recorded for the Founder digest.
      await sendEmail({
        to: notifyTo,
        subject: `Certification Operations: ${n.exception.category}`,
        html: certificationOperationsExceptionEmailHtml({
          category: n.exception.category,
          detail: n.exception.detail,
          derivedState: n.derivedState,
          hostId: n.hostId,
          candidateId: n.candidateId,
        }),
      });
    });

    await recordCronRun({ cronName: "certification-operations", startedAt, status: "success", detail: result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "certification-operations",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Certification operations cron failed." }, { status: 500 });
  }
}

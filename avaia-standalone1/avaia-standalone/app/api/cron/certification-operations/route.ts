import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordCertificationOperationsExceptions } from "@/lib/ops/certification-operations";
import { sendEmail } from "@/lib/resend";
import { certificationOperationsExceptionEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Certification Operations Agent, scheduled daily. Never emails a
// candidate -- notifies admin/ops only, of purely mechanical facts already
// computed by lib/certification-operations.ts (stale workflows, missing
// records, candidates ready for a human action, post-decision permission
// mismatches, failed/incomplete handoffs). Idempotent via
// recordCertificationOperationsExceptions's own cooldown, mirroring
// /api/cron/guide-operations exactly.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.CERTIFICATION_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

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

  return NextResponse.json({ ok: true, ...result });
}

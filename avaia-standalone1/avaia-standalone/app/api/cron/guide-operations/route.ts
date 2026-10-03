import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { runCertificationLifecycle, type CertificationLifecycleResult } from "@/lib/ops/guide-operations";
import { sendEmail } from "@/lib/resend";
import { certificationRenewalReminderEmailHtml } from "@/lib/ops/emails";
import { recordCronRun } from "@/lib/ops/cron-runs";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeEthics, describePayment, formatDateLabel } from "@/lib/certification-renewal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guide Operations: a certified Guide's STANDING after certification. Marks a
// lapsed certification inactive (never deletes it), notes when an inactive
// certification reaches the end of its reactivation window, and sends the
// Guide their 90/60/30/14/7-day renewal reminders. It tells Dorian nothing
// directly: anything that needs him (a renewal ready to confirm, a
// reactivation ready for his decision) is surfaced through the one shared
// Needs-Dorian source (lib/ops/needs-dorian.ts) and so appears identically in
// the Founder Digest and /admin/today. The candidate pipeline (before
// certification) is Certification Operations' and is not handled here.

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

  try {
    let certification: CertificationLifecycleResult | { error: string };
    try {
      certification = await runCertificationLifecycle(async (item) => {
        const { data: userData } = await admin.auth.admin.getUserById(item.hostId);
        const guideEmail = userData?.user?.email;
        // Throw rather than silently skip: a thrown send is treated as "not
        // actually sent" and retried on the next run.
        if (!guideEmail) throw new Error("No email address on file for this Guide.");

        const s = item.status;
        await sendEmail({
          to: guideEmail,
          subject: `Your AVAIA Guide certification period ends in ${s.daysRemaining ?? item.daysBefore} days`,
          html: certificationRenewalReminderEmailHtml({
            daysRemaining: s.daysRemaining ?? item.daysBefore,
            expiresOn: formatDateLabel(s.cycleEndsAt),
            ceApproved: s.ce.approvedInPeriod,
            ceRequired: s.ce.requiredCredits,
            ethicsLine: describeEthics(s),
            paymentLine: describePayment(s),
            statusUrl: `${siteUrl}/account#guide-certification`,
          }),
          context: "certification_renewal_reminder",
        });
      });
    } catch (err) {
      certification = { error: err instanceof Error ? err.message : String(err) };
      console.error("[guide-operations] certification lifecycle failed", err);
    }
    const certificationProblem =
      "error" in certification || certification.remindersFailed > 0 || certification.errors.length > 0;

    await recordCronRun({
      cronName: "guide-operations",
      startedAt,
      status: certificationProblem ? "partial" : "success",
      detail: { certification },
    });
    return NextResponse.json({ ok: true, certification });
  } catch (err) {
    await recordCronRun({
      cronName: "guide-operations",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Guide operations cron failed." }, { status: 500 });
  }
}

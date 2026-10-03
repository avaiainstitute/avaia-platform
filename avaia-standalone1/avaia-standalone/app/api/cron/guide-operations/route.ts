import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import {
  recordGuideOperationsReminders,
  runCertificationLifecycle,
  type CertificationLifecycleResult,
} from "@/lib/ops/guide-operations";
import { sendEmail } from "@/lib/resend";
import {
  guideOperationsWaitingNotificationEmailHtml,
  certificationRenewalReminderEmailHtml,
} from "@/lib/ops/emails";
import { recordCronRun } from "@/lib/ops/cron-runs";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeEthics, describePayment, formatDateLabel } from "@/lib/certification-renewal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_BY_TYPE: Record<string, string> = {
  paid_awaiting_decision: "Certification payment awaiting a decision",
  candidacy_stalled: "Guide candidacy waiting on next step",
  certified_awaiting_grant: "Certified decision awaiting the certification grant",
  certified_awaiting_toolkit_auth: "Certification awaiting Toolkit authorization",
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const notifyTo = process.env.GUIDE_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  const admin = createAdminClient();

  try {
    const result = await recordGuideOperationsReminders(async (item) => {
      // Throw rather than silently no-op when there's no configured
      // recipient -- recordGuideOperationsReminders treats a thrown sendFn
      // as "not actually sent" and won't start this item's cooldown.
      if (!notifyTo) {
        throw new Error("GUIDE_OPS_NOTIFICATION_EMAIL / CONTACT_NOTIFICATION_EMAIL is not configured.");
      }
      // Audit finding #3.4: resolve the email here so Dorian isn't forced
      // to re-look it up by hand before he can act on this notice.
      const { data: userData } = await admin.auth.admin.getUserById(item.hostId);
      const hostEmail = userData?.user?.email ?? null;

      await sendEmail({
        to: notifyTo,
        subject: SUBJECT_BY_TYPE[item.type],
        html: guideOperationsWaitingNotificationEmailHtml(
          item.type === "paid_awaiting_decision"
            ? { type: "paid_awaiting_decision", hostId: item.hostId, hostEmail, sinceDays: item.sinceDays }
            : item.type === "candidacy_stalled"
              ? { type: "candidacy_stalled", hostId: item.hostId, hostEmail, sinceDays: item.sinceDays, status: item.status }
              : { type: item.type, hostId: item.hostId, hostEmail, sinceDays: item.sinceDays }
        ),
      });
    });

    // Certification lifecycle (renewal cycle, Active -> Inactive, renewal
    // reminders to the Guide). Isolated in its own try/catch so a problem
    // here (for instance migration 0082 not yet applied) can never take down
    // the pipeline reminders above, which already ran.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";
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
      "error" in certification ||
      certification.remindersFailed > 0 ||
      certification.errors.length > 0;

    await recordCronRun({
      cronName: "guide-operations",
      startedAt,
      status: result.failed > 0 || certificationProblem ? "partial" : "success",
      detail: { ...result, certification },
    });
    return NextResponse.json({ ok: true, ...result, certification });
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

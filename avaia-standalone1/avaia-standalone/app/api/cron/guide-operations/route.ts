import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordGuideOperationsReminders } from "@/lib/ops/guide-operations";
import { sendEmail } from "@/lib/resend";
import { guideOperationsWaitingNotificationEmailHtml } from "@/lib/ops/emails";
import { recordCronRun } from "@/lib/ops/cron-runs";
import { createAdminClient } from "@/lib/supabase/admin";

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

    await recordCronRun({
      cronName: "guide-operations",
      startedAt,
      status: result.failed > 0 ? "partial" : "success",
      detail: result,
    });
    return NextResponse.json({ ok: true, ...result });
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

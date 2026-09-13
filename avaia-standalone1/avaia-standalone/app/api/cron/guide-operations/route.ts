import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordGuideOperationsReminders } from "@/lib/ops/guide-operations";
import { sendEmail } from "@/lib/resend";
import { guideOperationsWaitingNotificationEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent 7, scheduled. Unlike Agent 6, this never emails a candidate -- it
// notifies Dorian/admin that a purely mechanical waiting condition exists
// (a payment with no decision yet, or a candidacy with no recent recorded
// activity). It does not evaluate, rank, or comment on anyone's
// eligibility -- "do not invent certification requirements" is satisfied by
// this route never touching that question at all.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.GUIDE_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  const result = await recordGuideOperationsReminders(async (item) => {
    if (!notifyTo) return; // Nothing configured to notify yet; the item is still recorded for the Founder digest.
    await sendEmail({
      to: notifyTo,
      subject:
        item.type === "paid_awaiting_decision"
          ? "Certification payment awaiting a decision"
          : "Guide candidacy waiting on next step",
      html: guideOperationsWaitingNotificationEmailHtml(
        item.type === "paid_awaiting_decision"
          ? { type: "paid_awaiting_decision", hostId: item.hostId, sinceDays: item.sinceDays }
          : { type: "candidacy_stalled", hostId: item.hostId, sinceDays: item.sinceDays, status: item.status }
      ),
    });
  });

  return NextResponse.json({ ok: true, ...result });
}

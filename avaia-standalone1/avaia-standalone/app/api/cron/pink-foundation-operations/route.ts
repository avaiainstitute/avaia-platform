import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendFoundationReminders } from "@/lib/ops/pink-foundation-operations";
import { sendEmail } from "@/lib/resend";
import { pinkFoundationOperationsExceptionEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Pink Shoelace Foundation Operations + Legacy Control Agent's cron
// route -- a new, separate route from app/api/cron/host-onboarding (item
// 12's "do not create multiple overlapping participant crons" doesn't
// apply here: this covers an entirely different domain, Foundation/Legacy
// routing, not participant onboarding). Reuses the exact same cron-auth,
// email, and cooldown/idempotency infrastructure as every other
// Operations cron in this codebase.
//
// HARD RULE enforced here structurally: every email this route sends goes
// to PINK_NOTIFICATION_EMAIL / CONTACT_NOTIFICATION_EMAIL -- the
// Foundation's own internal notification address -- never to Legacy
// Global Programs. No Legacy recipient email has been verified anywhere
// in this codebase, so this route never contacts Legacy automatically,
// per the governing instruction's explicit condition on that.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  const result = await sendFoundationReminders(async ({ entityType, entityId, reminderType, category, reason, description }) => {
    if (!notifyTo) return;
    await sendEmail({
      to: notifyTo,
      subject: `Pink Shoelace Foundation Operations: ${category} (${reminderType})`,
      html: pinkFoundationOperationsExceptionEmailHtml({ entityType, category, reason, description, entityId }),
    });
  });

  return NextResponse.json({ ok: true, foundationReminders: result });
}

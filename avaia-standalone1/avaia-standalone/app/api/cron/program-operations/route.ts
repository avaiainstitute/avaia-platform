import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendProgramOperationsReminders } from "@/lib/ops/program-operations";
import { sendEmail } from "@/lib/resend";
import { programOperationsExceptionEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The AVAIA Program Operations Agent's cron route -- a new, separate
// route from every other Operations cron (post-certification specialty
// authorization is a distinct domain from onboarding, candidacy, or
// Guide Operations). Reuses the exact same cron-auth, email, and
// cooldown/idempotency infrastructure as every other Operations cron in
// this codebase.
//
// HARD RULE enforced here structurally: every email this route sends is
// an internal admin/evaluator/ops notice. It never emails a Guide
// directly, never creates a program_authorizations row, and never
// changes an enrollment's status -- it only records that an exception
// was surfaced (program_authorization_reminders), for a human to act on.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.PROGRAM_OPERATIONS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  const result = await sendProgramOperationsReminders(async ({ enrollmentId, hostId, program, category, reason }) => {
    if (!notifyTo) return;
    await sendEmail({
      to: notifyTo,
      subject: `Program Operations: ${category} (${program})`,
      html: programOperationsExceptionEmailHtml({ program, category, reason, enrollmentId, hostId }),
    });
  });

  return NextResponse.json({ ok: true, programOperationsReminders: result });
}

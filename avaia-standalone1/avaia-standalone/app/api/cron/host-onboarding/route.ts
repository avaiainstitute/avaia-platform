import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendStalledOnboardingReminders } from "@/lib/ops/host-onboarding";
import { recordHostParticipantOperationsExceptions } from "@/lib/ops/host-participant-operations";
import { sendEmail } from "@/lib/resend";
import { hostOnboardingReminderEmailHtml, hostParticipantOperationsExceptionEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent 6, scheduled. Vercel Cron calls this once a day (see vercel.json);
// isAuthorizedCronRequest fails closed if CRON_SECRET isn't set, so this
// route does nothing unless it is both deployed and deliberately
// configured -- it can never fire unauthenticated.
//
// Host / Participant Operations (this build) reuses this exact route and
// schedule rather than adding an overlapping cron -- see
// lib/ops/host-participant-operations.ts's own header comment for why its
// admin-only mismatch notifications are a separate concern from the
// participant-facing stalled-onboarding reminders above, even though both
// now run from the same daily trigger.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

  const result = await sendStalledOnboardingReminders(async (hostId, reminderType) => {
    // Only the email address is looked up -- never the Host's conversation
    // content, which this reminder never references (see
    // lib/ops/host-onboarding.ts's own header comment).
    const { data: userData } = await admin.auth.admin.getUserById(hostId);
    const email = userData?.user?.email;
    if (!email) return;

    await sendEmail({
      to: email,
      subject: "Whenever you're ready to continue",
      html: hostOnboardingReminderEmailHtml({ reminderType, journeyUrl: `${siteUrl}/journey` }),
    });
  });

  // Admin-only: deterministic Host/Participant mismatches (operational
  // state only, never conversation content). Never emails a Host, Guide,
  // or participant, and never changes membership_status, conversation or
  // guide_sessions status, or any access row.
  const opsAdminEmail = process.env.HOST_PARTICIPANT_OPS_NOTIFICATION_EMAIL || process.env.GUIDE_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  const hostParticipantResult = await recordHostParticipantOperationsExceptions(async (n) => {
    if (!opsAdminEmail) return;
    await sendEmail({
      to: opsAdminEmail,
      subject: `Host/Participant Operations: ${n.category}`,
      html: hostParticipantOperationsExceptionEmailHtml({
        subjectType: n.subjectType,
        category: n.category,
        detail: n.detail,
        operationalState: n.operationalState,
        subjectId: n.subjectId,
      }),
    });
  });

  return NextResponse.json({ ok: true, onboardingReminders: result, hostParticipantExceptions: hostParticipantResult });
}

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendFamilyInviteReminders } from "@/lib/ops/family-invite-reminders";
import { sendEmail } from "@/lib/resend";
import { familyInviteReminderEmailHtml } from "@/lib/ops/emails";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Automation audit finding #2.5. Reminds the invited person directly
// (same recipient the original invite email went to), same rate-limited,
// idempotent shape as every other reminder cron. See
// lib/ops/family-invite-reminders.ts for detection.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

  try {
    const result = await sendFamilyInviteReminders(async (invite) => {
      await sendEmail({
        to: invite.invitedEmail,
        subject: "Your AVAIA Family Membership invitation is still open",
        html: familyInviteReminderEmailHtml({
          acceptUrl: `${siteUrl}/family/accept/${invite.inviteToken}`,
        }),
        context: "family_invite_reminder",
      });
    });

    await recordCronRun({
      cronName: "family-invite-reminder",
      startedAt,
      status: result.failed > 0 ? "partial" : "success",
      detail: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "family-invite-reminder",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Family invite reminder cron failed." }, { status: 500 });
  }
}

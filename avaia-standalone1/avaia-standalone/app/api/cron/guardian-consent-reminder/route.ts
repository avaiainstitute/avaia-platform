import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendGuardianConsentReminders } from "@/lib/ops/guardian-consent-reminders";
import { sendEmail } from "@/lib/resend";
import { guardianConsentReminderEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Automation audit finding #5.3. Notifies the owning Guide, not Dorian --
// a stalled guardian consent is that Guide's own roster to follow up on,
// same posture host-onboarding's reminder takes toward the Host rather
// than Dorian. See lib/ops/guardian-consent-reminders.ts for detection.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const admin = createAdminClient();

  try {
    const result = await sendGuardianConsentReminders(async (item) => {
      const { data: userData } = await admin.auth.admin.getUserById(item.guideId);
      const email = userData?.user?.email;
      if (!email) throw new Error(`Guide ${item.guideId} has no email on file.`);

      await sendEmail({
        to: email,
        subject:
          item.type === "consent_pending" ? "Guardian consent still pending" : "Youth assent not yet confirmed",
        html: guardianConsentReminderEmailHtml({
          type: item.type,
          participantName: item.participantName,
          sinceDays: item.sinceDays,
        }),
      });
    });

    await recordCronRun({
      cronName: "guardian-consent-reminder",
      startedAt,
      status: result.failed > 0 ? "partial" : "success",
      detail: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "guardian-consent-reminder",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Guardian consent reminder cron failed." }, { status: 500 });
  }
}

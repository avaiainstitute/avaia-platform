import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendStalledOnboardingReminders } from "@/lib/ops/host-onboarding";
import { sendEmail } from "@/lib/resend";
import { hostOnboardingReminderEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

  try {
    const result = await sendStalledOnboardingReminders(async (hostId, reminderType) => {
      const { data: userData } = await admin.auth.admin.getUserById(hostId);
      const email = userData?.user?.email;
      // Throw rather than silently no-op -- see the matching comment in
      // sendStalledOnboardingReminders for why this matters.
      if (!email) throw new Error(`Host ${hostId} has no email on file.`);

      await sendEmail({
        to: email,
        subject: "Whenever you're ready to continue",
        html: hostOnboardingReminderEmailHtml({ reminderType, journeyUrl: `${siteUrl}/journey` }),
      });
    });

    await recordCronRun({
      cronName: "host-onboarding",
      startedAt,
      status: result.failed > 0 ? "partial" : "success",
      detail: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "host-onboarding",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Host onboarding cron failed." }, { status: 500 });
  }
}

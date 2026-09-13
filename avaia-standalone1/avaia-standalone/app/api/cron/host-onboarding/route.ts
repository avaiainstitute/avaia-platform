import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { sendStalledOnboardingReminders } from "@/lib/ops/host-onboarding";
import { sendEmail } from "@/lib/resend";
import { hostOnboardingReminderEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";

  const result = await sendStalledOnboardingReminders(async (hostId, reminderType) => {
    const { data: userData } = await admin.auth.admin.getUserById(hostId);
    const email = userData?.user?.email;
    if (!email) return;

    await sendEmail({
      to: email,
      subject: "Whenever you're ready to continue",
      html: hostOnboardingReminderEmailHtml({ reminderType, journeyUrl: `${siteUrl}/journey` }),
    });
  });

  return NextResponse.json({ ok: true, ...result });
}

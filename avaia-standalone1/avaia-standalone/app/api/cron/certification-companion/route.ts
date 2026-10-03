import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordCompanionCheckins } from "@/lib/ops/certification-companion";
import { sendEmail } from "@/lib/resend";
import { certificationCompanionCheckinEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCronRun } from "@/lib/ops/cron-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Certification check-ins, scheduled. Unlike the Certification Operations
// route (admin-only), this DOES contact the candidate directly: a warm,
// no-pressure note when their certification work has been quiet, rate
// limited by certification_companion_checkins. It says nothing about what is
// or is not complete and never implies a deadline. Same cron-secret auth as
// every other /api/cron/* route.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";
  const admin = createAdminClient();

  try {
    const result = await recordCompanionCheckins(async (item) => {
      const { data: userData } = await admin.auth.admin.getUserById(item.hostId);
      const email = userData?.user?.email;
      // Throw rather than silently skip: a thrown send is not recorded as
      // sent, so it is retried on the next run.
      if (!email) throw new Error(`Host ${item.hostId} has no email on file.`);
      await sendEmail({
        to: email,
        subject: "Checking in on your AVAIA Guide Certification",
        html: certificationCompanionCheckinEmailHtml({ classroomUrl: `${siteUrl}/certification` }),
      });
    });

    await recordCronRun({
      cronName: "certification-companion",
      startedAt,
      status: result.failed > 0 ? "partial" : "success",
      detail: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun({
      cronName: "certification-companion",
      startedAt,
      status: "error",
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "Certification check-in cron failed." }, { status: 500 });
  }
}

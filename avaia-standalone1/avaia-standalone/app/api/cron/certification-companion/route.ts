import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordCompanionCheckins } from "@/lib/ops/certification-companion";
import { sendEmail } from "@/lib/resend";
import { certificationCompanionCheckinEmailHtml } from "@/lib/ops/emails";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Certification Companion check-ins, scheduled. Unlike Agent 7
// (guide-operations), this DOES contact the candidate directly -- that is
// the entire point of this route, and it is a new, explicitly-named
// mechanism (lib/ops/certification-companion.ts), not a repurposing of
// Agent 7's internal-only reminder table. Same cron-secret auth as every
// other /api/cron/* route.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://avaiainstitute.com";
  const admin = createAdminClient();

  const result = await recordCompanionCheckins(async (item) => {
    const { data: userData } = await admin.auth.admin.getUserById(item.hostId);
    const email = userData?.user?.email;
    if (!email) return; // No email on record; still recorded as checked (cooldown applies).
    await sendEmail({
      to: email,
      subject: "Checking in on your AVAIA Guide Certification",
      html: certificationCompanionCheckinEmailHtml({ companionUrl: `${siteUrl}/certification/companion` }),
    });
  });

  return NextResponse.json({ ok: true, ...result });
}

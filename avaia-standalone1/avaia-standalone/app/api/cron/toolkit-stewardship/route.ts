import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordToolkitStewardshipReminders } from "@/lib/ops/toolkit-stewardship";
import { sendEmail } from "@/lib/resend";
import { toolkitStewardshipExceptionEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toolkit Stewardship Agent, scheduled daily. Never emails the Guide who
// filed an item -- notifies admin/ops only, of mechanical facts already
// computed by lib/toolkit-stewardship.ts (open/awaiting-human items,
// policy-required items, recurring patterns, registry health issues).
// Idempotent via recordToolkitStewardshipReminders's own cooldown,
// mirroring /api/cron/certification-operations exactly.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.TOOLKIT_STEWARDSHIP_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  const result = await recordToolkitStewardshipReminders(async (n) => {
    if (!notifyTo) return; // Nothing configured to notify yet; still recorded for the Founder digest.
    await sendEmail({
      to: notifyTo,
      subject: `Toolkit Stewardship: ${n.category}`,
      html: toolkitStewardshipExceptionEmailHtml({
        category: n.category,
        description: n.description,
        toolKey: n.toolKey,
        hostId: n.hostId,
        itemId: n.itemId,
      }),
    });
  });

  return NextResponse.json({ ok: true, ...result });
}

import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/ops/cron-auth";
import { recordConversationIntegrityReminders } from "@/lib/ops/conversation-integrity";
import { sendEmail } from "@/lib/resend";
import { conversationIntegrityExceptionEmailHtml } from "@/lib/ops/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conversation Integrity & Boundary Oversight Agent, scheduled daily.
// Never emails a Host or a Guide -- notifies admin/ops only, of a flag's
// category/severity/rule-implicated text (never message content, never a
// psychological conclusion). Idempotent via
// recordConversationIntegrityReminders's own cooldown, mirroring
// /api/cron/certification-operations exactly.
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifyTo = process.env.CONVERSATION_INTEGRITY_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;

  const result = await recordConversationIntegrityReminders(async (n) => {
    if (!notifyTo) return; // Nothing configured to notify yet; still recorded for the Founder digest.
    await sendEmail({
      to: notifyTo,
      subject: `Conversation Integrity: ${n.flagCategory} (${n.severity})`,
      html: conversationIntegrityExceptionEmailHtml({
        flagCategory: n.flagCategory,
        severity: n.severity,
        detail: n.detail,
        hostId: n.hostId,
        flagId: n.flagId,
      }),
    });
  });

  return NextResponse.json({ ok: true, ...result });
}

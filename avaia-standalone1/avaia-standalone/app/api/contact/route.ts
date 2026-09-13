import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, contactSubmissionEmailHtml } from "@/lib/resend";
import { detectCrisis } from "@/lib/engine/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  general: "General Inquiry",
  guiding: "One-on-One Guiding",
  workshops: "Workshops / Groups",
  schools: "Schools / Organizations",
  certification: "Certification",
  other: "Other",
};

// Which reasons always need Dorian personally, matching the same posture
// the Pink Shoelace contact route uses for its own institutional categories
// (lib/pink/classify.ts): a substantive inquiry about guiding, workshops,
// schools, or certification is never resolved by an automated
// acknowledgment alone. 'general' and 'other' still route to Dorian when
// the message itself asks a direct question, or trips the same crisis
// safety net used across the rest of AVAIA (see detectCrisis).
const ALWAYS_NEEDS_DORIAN = new Set(["guiding", "workshops", "schools", "certification"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim();
  const email = (body?.email ?? "").toString().trim();
  const reason = (body?.reason ?? "").toString().trim();
  const message = (body?.message ?? "").toString().trim();

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!(reason in REASON_LABEL)) {
    return NextResponse.json({ error: "Please choose a reason for contacting AVAIA." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }

  const needsDorian =
    ALWAYS_NEEDS_DORIAN.has(reason) || detectCrisis(message) || /\?/.test(message);

  // No signed-in session exists for a public contact form, writes go
  // through the service-role client, the same posture as the Stripe webhook
  // and the GPT OAuth tables: RLS enabled, zero public policies, only this
  // controlled server-side route can ever touch this table.
  const admin = createAdminClient();
  const { error: dbError } = await admin.from("contact_submissions").insert({
    name,
    email,
    reason,
    message,
    needs_dorian: needsDorian,
    follow_up_needed: needsDorian,
  });
  if (dbError) {
    console.error("AVAIA contact submission failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500 }
    );
  }

  // Best-effort notification, the submission above is already safely
  // saved regardless of whether this succeeds. Skipped entirely until
  // CONTACT_NOTIFICATION_EMAIL is configured in this deployment; nothing
  // here invents a destination address.
  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (to) {
    try {
      await sendEmail({
        to,
        subject: `AVAIA contact form: ${REASON_LABEL[reason]}${needsDorian ? " (needs review)" : ""}`,
        html: contactSubmissionEmailHtml({ name, email, reasonLabel: REASON_LABEL[reason], message }),
      });
    } catch (e) {
      console.error("AVAIA contact notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

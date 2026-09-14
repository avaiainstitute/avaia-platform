import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, contactSubmissionEmailHtml, contactAcknowledgmentEmailHtml } from "@/lib/resend";
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

  // Best-effort, never blocks or fails the submission itself -- the row
  // above is already saved regardless of whether this send succeeds.
  try {
    await sendEmail({
      to: email,
      subject: "We received your message",
      html: contactAcknowledgmentEmailHtml({ name }),
    });
  } catch (e) {
    console.error("AVAIA contact acknowledgment email failed:", e);
  }

  return NextResponse.json({ ok: true });
}

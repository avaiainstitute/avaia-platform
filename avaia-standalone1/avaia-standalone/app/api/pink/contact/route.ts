import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { pinkContactAcknowledgmentEmailHtml, pinkContactNotificationEmailHtml } from "@/lib/pink/emails";
import { classifyPinkContact } from "@/lib/pink/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cross-origin target for thepinkshoelace.org's own static contact form
// (Agent 1 / Automation Blueprint Phase 1). Same posture as
// app/api/contact/route.ts otherwise: no signed-in session exists for a
// public visitor, so all reads/writes go through the service-role client,
// and this table has zero public RLS policies (see migration 0063). Only
// the exact configured origin is allowed -- not a wildcard -- since this
// route accepts writes.
const ALLOWED_ORIGIN = process.env.PINK_SITE_ORIGIN || "https://thepinkshoelace.org";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim().slice(0, MAX_NAME_LENGTH);
  const email = (body?.email ?? "").toString().trim();
  const message = (body?.message ?? "").toString().trim();
  const source = (body?.source ?? "").toString().trim().slice(0, 200) || null;

  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400, headers: CORS_HEADERS });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400, headers: CORS_HEADERS });
  }
  if (!message) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400, headers: CORS_HEADERS });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400, headers: CORS_HEADERS });
  }

  const { category, needsDorian, followUpNeeded } = classifyPinkContact(message);

  const admin = createAdminClient();
  const { error: dbError } = await admin.from("pink_contact_submissions").insert({
    name,
    email,
    message,
    category,
    needs_dorian: needsDorian,
    follow_up_needed: followUpNeeded,
    source,
  });
  if (dbError) {
    console.error("Pink Shoelace contact submission failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Both emails are best-effort -- the submission above is already safely
  // saved regardless of whether either send succeeds.
  try {
    await sendEmail({
      to: email,
      subject: "We received your message — The Pink Shoelace Foundation",
      html: pinkContactAcknowledgmentEmailHtml({ name }),
    });
  } catch (e) {
    console.error("Pink Shoelace acknowledgment email failed:", e);
  }

  const notifyTo = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  if (notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        subject: `Pink Shoelace contact form: ${category}${needsDorian ? " (needs review)" : ""}`,
        html: pinkContactNotificationEmailHtml({ name, email, category, message }),
      });
    } catch (e) {
      console.error("Pink Shoelace contact notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

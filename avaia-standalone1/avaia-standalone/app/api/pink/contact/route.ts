import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { pinkContactAcknowledgmentEmailHtml, pinkContactNotificationEmailHtml } from "@/lib/pink/emails";
import { classifyPinkContact } from "@/lib/pink/classify";
import { ensurePartnershipFromContact, ensureDonorSponsorRecordFromContact } from "@/lib/pink/linking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { data: insertedContact, error: dbError } = await admin
    .from("pink_contact_submissions")
    .insert({
      name,
      email,
      message,
      category,
      needs_dorian: needsDorian,
      follow_up_needed: followUpNeeded,
      source,
    })
    .select("id")
    .single();
  if (dbError) {
    console.error("Pink Shoelace contact submission failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not send your message. Please try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

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

  // Agents 3 & 4 (Partnership, Donor & Sponsor): open the matching
  // downstream tracking record automatically. Best-effort, same posture as
  // the emails above -- the submitter's own successful response above never
  // depends on this succeeding.
  if (insertedContact?.id) {
    if (category === "partnership") {
      try {
        await ensurePartnershipFromContact(insertedContact.id, { name, email, message });
      } catch (e) {
        console.error("Pink Shoelace: partnership auto-link failed:", e);
      }
    } else if (category === "volunteer_or_donate") {
      try {
        await ensureDonorSponsorRecordFromContact(insertedContact.id, { name, email, message });
      } catch (e) {
        console.error("Pink Shoelace: donor/sponsor auto-link failed:", e);
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

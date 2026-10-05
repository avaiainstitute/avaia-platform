import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPinkEmail } from "@/lib/pink/mail";
import { pinkContactAcknowledgmentEmailHtml, pinkContactNotificationEmailHtml } from "@/lib/pink/emails";
import { classifyPinkContact } from "@/lib/pink/classify";
import { ensurePartnershipFromContact, ensureDonorSponsorRecordFromContact } from "@/lib/pink/linking";
import { pinkCorsHeaders, isAllowedPinkOrigin } from "@/lib/pink/cors";
import { honeypotTripped, isThrottled } from "@/lib/pink/abuse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: pinkCorsHeaders(request) });
}

export async function POST(request: Request) {
  const CORS_HEADERS = pinkCorsHeaders(request);

  // Basic spam protection (lib/pink/abuse.ts): the Foundation's own site only, a hidden field a
  // person never sees, and a per-hour limit. A tripped trap answers like a success and stores nothing.
  if (!isAllowedPinkOrigin(request)) {
    return NextResponse.json({ error: "This form can only be sent from thepinkshoelace.org." }, { status: 403, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => ({}));
  if (honeypotTripped(body)) return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });

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
  if (await isThrottled("pink_contact_submissions", email)) {
    return NextResponse.json({ error: "Too many messages just now. Please try again later." }, { status: 429, headers: CORS_HEADERS });
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

  // Acknowledgment. The record is marked "acknowledged" only if the acknowledgment actually went
  // out; if it did not, the record stays "new" and the failure is logged (email_send_failures).
  try {
    await sendPinkEmail({
      to: email,
      subject: "We received your message — The Pink Shoelace Foundation",
      html: pinkContactAcknowledgmentEmailHtml({ name }),
      context: "contact_acknowledgment",
    });
    if (insertedContact?.id) {
      await admin
        .from("pink_contact_submissions")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", insertedContact.id)
        .eq("status", "new");
    }
  } catch (e) {
    console.error("Pink Shoelace acknowledgment email failed:", e);
  }

  const notifyTo = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  if (notifyTo) {
    try {
      await sendPinkEmail({
        to: notifyTo,
        subject: `Pink Shoelace contact form: ${category}${needsDorian ? " (needs review)" : ""}`,
        html: pinkContactNotificationEmailHtml({ name, email, category, message }),
        context: "contact_notification",
      });
    } catch (e) {
      console.error("Pink Shoelace contact notification email failed:", e);
    }
  }

  // Partnership and volunteer/donate tracking records: open the matching downstream record
  // automatically. Best-effort, same posture as the emails above.
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

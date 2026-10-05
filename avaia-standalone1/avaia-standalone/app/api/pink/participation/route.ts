import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPinkEmail } from "@/lib/pink/mail";
import {
  pinkParticipationAcknowledgmentEmailHtml,
  pinkParticipationNotificationEmailHtml,
} from "@/lib/pink/emails";
import { participationNeedsDorian, type PinkParticipationInterestType } from "@/lib/pink/classify";
import { pinkCorsHeaders, isAllowedPinkOrigin } from "@/lib/pink/cors";
import { honeypotTripped, isThrottled } from "@/lib/pink/abuse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEREST_TYPES: PinkParticipationInterestType[] = [
  "wear_shoelace",
  "walk_alongside",
  "honor_someone",
  "foundation_participation",
  "other",
];
const MAX_TEXT_LENGTH = 2000;

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

  const name = (body?.name ?? "").toString().trim().slice(0, 200);
  const email = (body?.email ?? "").toString().trim();
  const interestType = (body?.interestType ?? "").toString().trim();
  const note = (body?.note ?? "").toString().trim().slice(0, MAX_TEXT_LENGTH) || null;
  const honoreeName = (body?.honoreeName ?? "").toString().trim().slice(0, 200) || null;
  const source = (body?.source ?? "").toString().trim().slice(0, 200) || null;

  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400, headers: CORS_HEADERS });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400, headers: CORS_HEADERS });
  }
  if (!INTEREST_TYPES.includes(interestType as PinkParticipationInterestType)) {
    return NextResponse.json({ error: "Please choose what you're interested in." }, { status: 400, headers: CORS_HEADERS });
  }
  if (await isThrottled("pink_participation_interest", email)) {
    return NextResponse.json({ error: "Too many submissions just now. Please try again later." }, { status: 429, headers: CORS_HEADERS });
  }

  // needs_dorian stays a classification flag shown in the inquiry list. Every open submission,
  // flagged or not, now appears in the Foundation's attention list (lib/pink/ops.ts), so no
  // submission type can sit unseen.
  const needsDorian = participationNeedsDorian(interestType as PinkParticipationInterestType);

  const admin = createAdminClient();
  const { data: inserted, error: dbError } = await admin
    .from("pink_participation_interest")
    .insert({
      interest_type: interestType,
      name,
      email,
      note,
      honoree_name: honoreeName,
      needs_dorian: needsDorian,
      follow_up_needed: needsDorian,
      source,
    })
    .select("id")
    .single();
  if (dbError) {
    console.error("Pink Shoelace participation interest failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not save your interest. Please try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Acknowledgment. Marked "acknowledged" only if it actually went out.
  try {
    await sendPinkEmail({
      to: email,
      subject: "Thank you — The Pink Shoelace Foundation",
      html: pinkParticipationAcknowledgmentEmailHtml({ name, interestType }),
      context: "participation_acknowledgment",
    });
    if (inserted?.id) {
      await admin
        .from("pink_participation_interest")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", inserted.id)
        .eq("status", "new");
    }
  } catch (e) {
    console.error("Pink Shoelace participation acknowledgment email failed:", e);
  }

  const notifyTo = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  if (notifyTo) {
    try {
      await sendPinkEmail({
        to: notifyTo,
        subject: `Pink Shoelace participation interest: ${interestType}${needsDorian ? " (needs review)" : ""}`,
        html: pinkParticipationNotificationEmailHtml({ name, email, interestType, note, honoreeName }),
        context: "participation_notification",
      });
    } catch (e) {
      console.error("Pink Shoelace participation notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

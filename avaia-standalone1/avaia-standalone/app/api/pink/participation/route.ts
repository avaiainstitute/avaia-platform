import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import {
  pinkParticipationAcknowledgmentEmailHtml,
  pinkParticipationNotificationEmailHtml,
} from "@/lib/pink/emails";
import { participationNeedsDorian, type PinkParticipationInterestType } from "@/lib/pink/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No live form on thepinkshoelace.org captures this yet (Get Involved lists
// these as intentions; the site itself says several are "coming soon") --
// see docs/PINK_INTEGRATION.md. This route is the backend those forms can
// point at once built; it does not claim any of them are wired today.
const ALLOWED_ORIGIN = process.env.PINK_SITE_ORIGIN || "https://thepinkshoelace.org";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTEREST_TYPES: PinkParticipationInterestType[] = [
  "wear_shoelace",
  "walk_alongside",
  "honor_someone",
  "foundation_participation",
  "other",
];
const MAX_TEXT_LENGTH = 2000;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
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

  const needsDorian = participationNeedsDorian(interestType as PinkParticipationInterestType);

  const admin = createAdminClient();
  const { error: dbError } = await admin.from("pink_participation_interest").insert({
    interest_type: interestType,
    name,
    email,
    note,
    honoree_name: honoreeName,
    needs_dorian: needsDorian,
    follow_up_needed: needsDorian,
    source,
  });
  if (dbError) {
    console.error("Pink Shoelace participation interest failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not save your interest. Please try again." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    await sendEmail({
      to: email,
      subject: "Thank you — The Pink Shoelace Foundation",
      html: pinkParticipationAcknowledgmentEmailHtml({ name, interestType }),
    });
  } catch (e) {
    console.error("Pink Shoelace participation acknowledgment email failed:", e);
  }

  const notifyTo = process.env.PINK_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
  if (notifyTo) {
    try {
      await sendEmail({
        to: notifyTo,
        subject: `Pink Shoelace participation interest: ${interestType}${needsDorian ? " (needs review)" : ""}`,
        html: pinkParticipationNotificationEmailHtml({ name, email, interestType, note, honoreeName }),
      });
    } catch (e) {
      console.error("Pink Shoelace participation notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

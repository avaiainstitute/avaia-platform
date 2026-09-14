import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, experienceInquiryEmailHtml } from "@/lib/resend";
import { EXPERIENCE_TYPES, EXPERIENCE_LABEL, GROUP_TYPES, GROUP_TYPE_LABEL, type ExperienceType, type GroupType } from "@/lib/experiences-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent 8 (Programs & Experiences), inbound. Same-origin AVAIA page (see
// app/experiences/page.tsx), so no CORS handling is needed here -- unlike
// the Pink Shoelace routes, which accept submissions from a separate site.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 3000;
const MAX_NAME_LENGTH = 200;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim().slice(0, MAX_NAME_LENGTH);
  const email = (body?.email ?? "").toString().trim();
  const phone = (body?.phone ?? "").toString().trim().slice(0, 100) || null;
  const organizationName = (body?.organizationName ?? "").toString().trim().slice(0, 300) || null;
  const groupTypeRaw = (body?.groupType ?? "").toString().trim();
  const approxGroupSize = (body?.approxGroupSize ?? "").toString().trim().slice(0, 200) || null;
  const location = (body?.location ?? "").toString().trim().slice(0, 300) || null;
  const experienceInterestRaw = (body?.experienceInterest ?? "").toString().trim();
  const requestDetails = (body?.requestDetails ?? "").toString().trim().slice(0, MAX_TEXT_LENGTH) || null;

  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const groupType: GroupType = GROUP_TYPES.includes(groupTypeRaw as GroupType)
    ? (groupTypeRaw as GroupType)
    : "other";
  if (!EXPERIENCE_TYPES.includes(experienceInterestRaw as ExperienceType)) {
    return NextResponse.json({ error: "Please choose what you're interested in." }, { status: 400 });
  }
  const experienceInterest = experienceInterestRaw as ExperienceType;

  const admin = createAdminClient();
  const { error: dbError } = await admin.from("avaia_experience_inquiries").insert({
    name,
    email,
    phone,
    organization_name: organizationName,
    group_type: groupType,
    approx_group_size: approxGroupSize,
    location,
    experience_interest: experienceInterest,
    request_details: requestDetails,
    source: "avaiainstitute.com/experiences",
  });
  if (dbError) {
    console.error("AVAIA experience inquiry failed to save:", dbError.message);
    return NextResponse.json(
      { error: "Could not send your inquiry. Please try again." },
      { status: 500 }
    );
  }

  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (to) {
    try {
      await sendEmail({
        to,
        subject: `AVAIA Experience inquiry: ${EXPERIENCE_LABEL[experienceInterest]}`,
        html: experienceInquiryEmailHtml({
          name,
          email,
          phone,
          organizationName,
          groupTypeLabel: GROUP_TYPE_LABEL[groupType],
          approxGroupSize,
          location,
          experienceLabel: EXPERIENCE_LABEL[experienceInterest],
          requestDetails,
        }),
      });
    } catch (e) {
      console.error("AVAIA experience inquiry notification email failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

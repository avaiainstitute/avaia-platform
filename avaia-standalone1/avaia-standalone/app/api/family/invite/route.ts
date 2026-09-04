import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteFamilyMember } from "@/lib/family-membership";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only: invites a family member by email. Re-verifies the caller
 *  owns an active Family plan inside inviteFamilyMember() itself -- this
 *  route does no authorization decision of its own beyond requiring a
 *  signed-in caller. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";

  const admin = createAdminClient();
  const result = await inviteFamilyMember(supabase, admin, user.id, email);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const origin = new URL(request.url).origin;
  const acceptUrl = `${origin}/family/accept/${result.inviteToken}`;
  try {
    await sendEmail({
      to: email.trim(),
      subject: "You're invited to an AVAIA Family Membership",
      html: `
        <p>You've been invited to join a Family AVAIA Membership.</p>
        <p>Each person keeps their own private AVAIA account, Journey, and Workbook —
        joining a Family plan only shares payment, never your private conversations.</p>
        <p><a href="${acceptUrl}">Accept the invitation</a></p>
        <p style="color:#888">If you weren't expecting this, you can safely ignore this email.</p>
      `.trim(),
    });
  } catch (e) {
    console.error("AVAIA Family invite: failed to send email:", e);
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, inviteEmailHtml } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No admin.getUserByEmail exists in supabase-js — listUsers() is the only
 *  documented way, and it's paginated with no server-side email filter, so
 *  this pages through every account comparing emails. Fine at pilot scale;
 *  would need a real index (or a public.profiles email mirror) to stay fast
 *  at a larger user count. Capped at 20 pages (20,000 accounts) as a backstop. */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) break;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const scope: string | undefined = body?.scope;
  const conversationId: string | undefined = body?.conversationId;
  const email: string = (body?.email ?? "").toString().trim().toLowerCase();

  if (scope !== "conversation" && scope !== "workbook") {
    return NextResponse.json({ error: "Invalid scope." }, { status: 400 });
  }
  if (scope === "conversation" && !conversationId) {
    return NextResponse.json({ error: "Missing conversation to share." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (user.email && email === user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can't share with yourself." }, { status: 400 });
  }

  // Ownership check — a Host may only share conversations that are theirs.
  if (scope === "conversation") {
    const { data: convo } = await supabase
      .from("conversations")
      .select("id, host_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!convo || convo.host_id !== user.id) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
  }

  const existingUserId = await findUserIdByEmail(email);

  if (existingUserId) {
    const { error } = await supabase.from("shared_access").insert({
      owner_id: user.id,
      shared_with_id: existingUserId,
      scope,
      conversation_id: scope === "conversation" ? conversationId : null,
    });
    if (error) return NextResponse.json({ error: "Could not grant access." }, { status: 500 });
    return NextResponse.json({ status: "granted" });
  }

  // No account yet — record the invite and email them; handle_new_user()
  // converts it into a real grant automatically once they sign up.
  const { error: inviteError } = await supabase.from("shared_access_invites").insert({
    owner_id: user.id,
    invited_email: email,
    scope,
    conversation_id: scope === "conversation" ? conversationId : null,
  });
  if (inviteError) return NextResponse.json({ error: "Could not create the invite." }, { status: 500 });

  try {
    const origin = new URL(request.url).origin;
    await sendEmail({
      to: email,
      subject: "You've been invited to AVAIA",
      html: inviteEmailHtml({
        ownerLabel: user.email ?? "An AVAIA Host",
        scopeLabel: scope === "workbook" ? "their AVAIA Workbook" : "a conversation from their AVAIA Workbook",
        signUpUrl: `${origin}/sign-in`,
      }),
    });
  } catch (e) {
    console.error("AVAIA Workbook share invite email failed:", e);
    // The invite row is still saved — access still activates on signup even
    // if the email itself failed to send (e.g. Resend not yet configured).
  }

  return NextResponse.json({ status: "invited" });
}

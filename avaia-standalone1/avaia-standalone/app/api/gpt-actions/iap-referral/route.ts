import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation } from "@/lib/engine/conversation";

// PROOF OF CONCEPT — the only entry point the real IAP custom GPT's Action
// calls. No Supabase session exists on this request at all (OpenAI's
// servers call this directly, not a Host's browser), so everything here
// goes through the service-role client, same pattern as the Stripe webhook.
//
// Two layers of authorization, checked in order:
//   1. Static bearer secret (GPT_ACTION_API_KEY) — proves the caller is the
//      configured Action, not an arbitrary request against a guessed URL.
//   2. The single-use session token in the body — proves which Host this
//      referral belongs to. The token is the sole source of truth for that
//      binding; nothing the payload itself claims about identity is trusted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.GPT_ACTION_API_KEY ?? ""}`;
  if (!process.env.GPT_ACTION_API_KEY || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  const referral: unknown = body?.referral;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }
  if (!referral || typeof referral !== "object" || Array.isArray(referral)) {
    return NextResponse.json({ error: "Missing or invalid referral." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: session, error: lookupError } = await admin
    .from("gpt_handoff_sessions")
    .select("id, host_id, conversation_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (lookupError || !session) {
    return NextResponse.json({ error: "Unknown session token." }, { status: 400 });
  }
  if (session.status !== "pending") {
    return NextResponse.json({ error: "This session has already been used." }, { status: 409 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await admin.from("gpt_handoff_sessions").update({ status: "expired" }).eq("id", session.id);
    return NextResponse.json({ error: "This session has expired." }, { status: 410 });
  }

  // Store the referral, complete the IAP conversation, open CAT — the exact
  // same shape the existing Anthropic-driven referral route already writes.
  const { error: insertError } = await admin.from("referrals").insert({
    host_id: session.host_id,
    from_stage: "iap",
    to_stage: "cat",
    content: referral,
    conversation_id: session.conversation_id,
  });
  if (insertError) {
    return NextResponse.json({ error: "Could not store the referral." }, { status: 500 });
  }

  await admin
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", session.conversation_id);

  await admin
    .from("gpt_handoff_sessions")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", session.id);

  await createConversation(admin, session.host_id, "cat");

  return NextResponse.json({ ok: true });
}

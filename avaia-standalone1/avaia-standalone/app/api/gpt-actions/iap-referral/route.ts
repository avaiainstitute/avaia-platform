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

// TEMPORARY DEBUG — server-side only, visible in Vercel's function logs, not
// shown to the Host. Remove once the referral-return path is diagnosed.
function debugLog(step: string, fields: Record<string, unknown>) {
  console.log("[gpt-iap-referral debug]", { step, ts: new Date().toISOString(), ...fields });
}

export async function POST(request: Request) {
  // STEP 1 — request received, before anything is validated.
  debugLog("1_request_received", {});

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.GPT_ACTION_API_KEY ?? ""}`;
  if (!process.env.GPT_ACTION_API_KEY || authHeader !== expected) {
    debugLog("1_request_received", { result: "FAILED — bad or missing bearer auth" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  const referral: unknown = body?.referral;
  debugLog("1_request_received", {
    result: "auth OK",
    hasToken: !!token,
    referralKeys:
      referral && typeof referral === "object" && !Array.isArray(referral)
        ? Object.keys(referral)
        : null,
  });

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

  // STEP 2 — immediately after token validation.
  debugLog("2_token_validated", {
    handoffSessionId: session?.id ?? null,
    conversationId: session?.conversation_id ?? null,
    sessionStatus: session?.status ?? null,
    lookupError: lookupError?.message ?? null,
    result: lookupError || !session ? "FAILED — unknown token" : "OK",
  });

  if (lookupError || !session) {
    return NextResponse.json({ error: "Unknown session token." }, { status: 400 });
  }
  if (session.status !== "pending") {
    debugLog("2_token_validated", {
      handoffSessionId: session.id,
      conversationId: session.conversation_id,
      result: `FAILED — session status is "${session.status}", not "pending"`,
    });
    return NextResponse.json({ error: "This session has already been used." }, { status: 409 });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    debugLog("2_token_validated", {
      handoffSessionId: session.id,
      conversationId: session.conversation_id,
      result: "FAILED — token expired",
    });
    await admin.from("gpt_handoff_sessions").update({ status: "expired" }).eq("id", session.id);
    return NextResponse.json({ error: "This session has expired." }, { status: 410 });
  }

  // STEP 3 — immediately before referrals.insert().
  debugLog("3_before_referral_insert", {
    handoffSessionId: session.id,
    conversationId: session.conversation_id,
  });

  // Store the referral, complete the IAP conversation, open CAT — the exact
  // same shape the existing Anthropic-driven referral route already writes.
  const { error: insertError } = await admin.from("referrals").insert({
    host_id: session.host_id,
    from_stage: "iap",
    to_stage: "cat",
    content: referral,
    conversation_id: session.conversation_id,
  });

  // STEP 4 — immediately after referrals.insert().
  debugLog("4_after_referral_insert", {
    handoffSessionId: session.id,
    conversationId: session.conversation_id,
    result: insertError ? "FAILED" : "OK",
    insertError: insertError
      ? { message: insertError.message, details: insertError.details, hint: insertError.hint }
      : null,
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not store the referral." }, { status: 500 });
  }

  const { error: completeError } = await admin
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", session.conversation_id);

  // STEP 5 — immediately after conversations.status is updated to "complete".
  debugLog("5_after_conversation_complete", {
    handoffSessionId: session.id,
    conversationId: session.conversation_id,
    result: completeError ? "FAILED" : "OK",
    completeError: completeError ? completeError.message : null,
  });

  await admin
    .from("gpt_handoff_sessions")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", session.id);

  await createConversation(admin, session.host_id, "cat");

  return NextResponse.json({ ok: true });
}

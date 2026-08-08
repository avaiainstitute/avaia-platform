import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation, type DbConversation } from "@/lib/engine/conversation";

// PROOF OF CONCEPT — the only entry point the real IAP custom GPT's Action
// calls. No Supabase session exists on this request at all (OpenAI's
// servers call this directly, not a Host's browser), so everything here
// goes through the service-role client, same pattern as the Stripe webhook.
//
// Identity now comes entirely from a real OAuth bearer access token
// (issued by app/api/oauth/token/route.ts after the Host approved
// /oauth/authorize) — nothing the model has to remember or reproduce.
// Replaces the earlier static-key + body-supplied-token design, which two
// separate real-conversation tests showed the model never reliably acted
// on regardless of how that value was shaped.
//
// Because the OAuth token identifies WHO, not WHICH conversation, this
// looks up the Host's current active IAP conversation directly — the same
// "one active conversation per Host" assumption the rest of AVAIA already
// relies on (lib/engine/conversation.ts's getActiveConversation).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kept from the earlier debugging round — this is the first real test of a
// brand-new mechanism, and losing visibility again would mean starting
// from zero if it doesn't work the first time. Remove once confirmed
// reliable.
function debugLog(step: string, fields: Record<string, unknown>) {
  console.log("[gpt-iap-referral debug]", { step, ts: new Date().toISOString(), ...fields });
}

export async function POST(request: Request) {
  debugLog("1_request_received", {});

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    debugLog("1_request_received", { result: "FAILED — no Bearer token present" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const body = await request.json().catch(() => ({}));
  const referral: unknown = body?.referral;
  debugLog("1_request_received", {
    result: "has bearer token",
    referralKeys:
      referral && typeof referral === "object" && !Array.isArray(referral)
        ? Object.keys(referral)
        : null,
  });

  if (!referral || typeof referral !== "object" || Array.isArray(referral)) {
    return NextResponse.json({ error: "Missing or invalid referral." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tokenRow, error: tokenLookupError } = await admin
    .from("oauth_access_tokens")
    .select("id, host_id, revoked_at, expires_at")
    .eq("access_token", accessToken)
    .maybeSingle();

  debugLog("2_oauth_token_validated", {
    hostId: tokenRow?.host_id ?? null,
    revokedAt: tokenRow?.revoked_at ?? null,
    lookupError: tokenLookupError?.message ?? null,
    result: tokenLookupError || !tokenRow ? "FAILED — unknown access token" : "OK",
  });

  if (tokenLookupError || !tokenRow) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  if (tokenRow.revoked_at) {
    return NextResponse.json({ error: "invalid_token", error_description: "revoked" }, { status: 401 });
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "invalid_token", error_description: "expired" }, { status: 401 });
  }

  const hostId = tokenRow.host_id as string;

  const { data: convo, error: convoError } = await admin
    .from("conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("stage", "iap")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeConvo = convo as DbConversation | null;

  debugLog("3_active_conversation_lookup", {
    hostId,
    conversationId: activeConvo?.id ?? null,
    lookupError: convoError?.message ?? null,
    result: convoError || !activeConvo ? "FAILED — no active IAP conversation for this Host" : "OK",
  });

  if (convoError || !activeConvo) {
    return NextResponse.json(
      { error: "no_active_conversation", error_description: "No active IAP conversation found for this Host." },
      { status: 409 }
    );
  }

  const { error: insertError } = await admin.from("referrals").insert({
    host_id: hostId,
    from_stage: "iap",
    to_stage: "cat",
    content: referral,
    conversation_id: activeConvo.id,
  });

  debugLog("4_after_referral_insert", {
    hostId,
    conversationId: activeConvo.id,
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
    .eq("id", activeConvo.id);

  debugLog("5_after_conversation_complete", {
    hostId,
    conversationId: activeConvo.id,
    result: completeError ? "FAILED" : "OK",
    completeError: completeError ? completeError.message : null,
  });

  await createConversation(admin, hostId, "cat");

  return NextResponse.json({ ok: true });
}

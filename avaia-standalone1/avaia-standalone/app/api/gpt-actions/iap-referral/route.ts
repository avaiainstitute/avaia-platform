import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation, STAGE_ORDER, type DbConversation } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";

// The entry point every real custom GPT's Action calls — IAP, Conversations
// Across Time, and InnerCompass all point here. (The path still says
// "iap-referral" only because that's what the IAP GPT was already
// configured with before this became stage-agnostic; renaming it would mean
// re-editing a GPT that already works for no functional benefit.)
//
// No Supabase session exists on this request at all (OpenAI's servers call
// this directly, not a Host's browser), so everything here goes through the
// service-role client, same pattern as the Stripe webhook.
//
// Identity comes entirely from a real OAuth bearer access token (issued by
// app/api/oauth/token/route.ts after the Host approved /oauth/authorize) —
// nothing the model has to remember or reproduce.
//
// Because the OAuth token identifies WHO, not WHICH conversation or stage,
// this looks up the Host's current active conversation directly (whatever
// stage it's at) and derives from_stage/to_stage/the next stage from that —
// the same "one active conversation per Host" assumption the rest of AVAIA
// already relies on. That conversation's `program` is read back and carried
// forward into whichever stage comes next, so a referral coming home from
// any workshop trip lands somewhere the receiving side (crossing screens,
// dashboard) actually recognizes as belonging to that program.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kept from the earlier debugging round — this was the first real test of a
// brand-new mechanism, and losing visibility again would mean starting from
// zero if something regresses. Remove once this has run reliably for a
// while in real use.
function debugLog(step: string, fields: Record<string, unknown>) {
  console.log("[gpt-referral debug]", { step, ts: new Date().toISOString(), ...fields });
}

export async function POST(request: Request) {
  debugLog("1_request_received", {});

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    debugLog("1_request_received", { result: "FAILED — no Bearer token present" });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const rawBodyText = await request.text();
  const body = (() => {
    try {
      return JSON.parse(rawBodyText);
    } catch {
      return {};
    }
  })();
  const referral: unknown = body?.referral;
  debugLog("1_request_received", {
    result: "has bearer token",
    bodyKeys: body && typeof body === "object" ? Object.keys(body) : null,
    referralType: typeof referral,
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

  // No .eq("stage", ...) here on purpose -- this endpoint now serves
  // whichever stage's GPT calls it, so it just finds whatever this Host's
  // one active conversation currently is.
  const { data: convo, error: convoError } = await admin
    .from("conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeConvo = convo as DbConversation | null;

  debugLog("3_active_conversation_lookup", {
    hostId,
    conversationId: activeConvo?.id ?? null,
    stage: activeConvo?.stage ?? null,
    program: activeConvo?.program ?? null,
    lookupError: convoError?.message ?? null,
    result: convoError || !activeConvo ? "FAILED — no active conversation for this Host" : "OK",
  });

  if (convoError || !activeConvo) {
    return NextResponse.json(
      { error: "no_active_conversation", error_description: "No active conversation found for this Host." },
      { status: 409 }
    );
  }

  const fromStage = activeConvo.stage as Stage;
  const currentIdx = STAGE_ORDER.indexOf(fromStage);
  const nextStage: Stage | null = STAGE_ORDER[currentIdx + 1] ?? null;

  const { error: insertError } = await admin.from("referrals").insert({
    host_id: hostId,
    from_stage: fromStage,
    // Mirrors app/api/referral/route.ts's own convention for the website
    // flow: "continuity" when there's no next stage (InnerCompass finishing).
    to_stage: nextStage ?? "continuity",
    content: referral,
    conversation_id: activeConvo.id,
  });

  debugLog("4_after_referral_insert", {
    hostId,
    conversationId: activeConvo.id,
    fromStage,
    nextStage,
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

  // Carry the program tag forward -- without this, a referral coming home
  // from a Defying Grief workshop trip would silently land in a 'general'
  // conversation, invisible to the Defying Grief dashboard and crossing
  // screens. Only create the next stage if there is one; InnerCompass
  // finishing has nothing after it.
  if (nextStage) {
    await createConversation(admin, hostId, nextStage, undefined, activeConvo.program);
  }

  return NextResponse.json({ ok: true, done: nextStage === null });
}

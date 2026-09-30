import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGE_ORDER, type DbConversation } from "@/lib/engine/conversation";
import type { Stage } from "@/lib/engine/prompts";

// The pull side of the same architecture the submit endpoint already proves
// works (see app/api/gpt-actions/iap-referral/route.ts). CAT and
// InnerCompass's GPTs call this at the very start of a conversation, using
// the same OAuth bearer token, to receive the referral the previous stage
// already produced, so the Host never has to retell their story. IAP has
// nothing before it and never calls this.
//
// Returns the referral's content exactly as it was stored, the full
// artifact, not a summary of it. Whatever shape the previous stage's GPT
// submitted is what comes back here.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const admin = createAdminClient();

  const { data: tokenRow, error: tokenLookupError } = await admin
    .from("oauth_access_tokens")
    .select("id, host_id, revoked_at, expires_at")
    .eq("access_token", accessToken)
    .maybeSingle();

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

  // Same "one active conversation per Host" lookup the submit endpoint uses
  //, whichever conversation is currently waiting tells us what stage the
  // Host is arriving at, and therefore which stage's referral to look back
  // for.
  const { data: convo, error: convoError } = await admin
    .from("conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeConvo = convo as DbConversation | null;

  if (convoError || !activeConvo) {
    return NextResponse.json(
      { error: "no_active_conversation", error_description: "No active conversation found for this Host." },
      { status: 409 }
    );
  }

  const currentIdx = STAGE_ORDER.indexOf(activeConvo.stage as Stage);
  const previousStage: Stage | null = currentIdx > 0 ? STAGE_ORDER[currentIdx - 1] : null;

  if (!previousStage) {
    return NextResponse.json(
      { error: "no_incoming_referral", error_description: "This is the first stage; there is nothing to carry in." },
      { status: 404 }
    );
  }

  const { data: previousConvo, error: previousConvoError } = await admin
    .from("conversations")
    .select("id")
    .eq("host_id", hostId)
    .eq("program", activeConvo.program)
    .eq("stage", previousStage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousConvoError || !previousConvo) {
    return NextResponse.json(
      { error: "no_incoming_referral", error_description: "No prior conversation found to carry a referral from." },
      { status: 404 }
    );
  }

  const { data: referralRow, error: referralError } = await admin
    .from("referrals")
    .select("content, from_stage, created_at")
    .eq("conversation_id", previousConvo.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (referralError || !referralRow) {
    return NextResponse.json(
      { error: "no_incoming_referral", error_description: "No referral was found for the prior stage." },
      { status: 404 }
    );
  }

  return NextResponse.json({ referral: referralRow.content });
}

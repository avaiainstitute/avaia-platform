import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIRTUES, VIRTUE_FAMILIES, type VirtueFamilyKey } from "@/lib/virtues";

// The entry point the standalone Unsung Heroes GPT's Action calls, mirroring
// app/api/gpt-actions/iap-referral/route.ts's OAuth pattern exactly -- same
// shared Client ID/Secret, same bearer-token-identifies-the-Host model. This
// is a separate, simpler endpoint (not folded into iap-referral) because
// Unsung Heroes has no "active conversation" or "next stage" concept: the
// conversation happens entirely inside the GPT itself, and this call is a
// single, self-contained submission straight into the recognitions table --
// same table the website's own in-page chat writes to
// (app/api/unsung-heroes/recognition/route.ts), so a recognition made in the
// standalone GPT shows up in the Host's workbook exactly like one made on
// the site.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_TYPES = ["school", "community", "family"] as const;
const CONVERSATION_PATHS = [
  "i_saw_someone",
  "someone_recognized_me",
  "something_difficult",
  "i_want_to_grow",
] as const;

function debugLog(step: string, fields: Record<string, unknown>) {
  console.log("[unsung-heroes-gpt debug]", { step, ts: new Date().toISOString(), ...fields });
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
  const recognition = body?.recognition;
  debugLog("1_request_received", {
    result: "has bearer token",
    bodyKeys: body && typeof body === "object" ? Object.keys(body) : null,
    recognitionKeys:
      recognition && typeof recognition === "object" && !Array.isArray(recognition)
        ? Object.keys(recognition)
        : null,
  });

  if (!recognition || typeof recognition !== "object" || Array.isArray(recognition)) {
    return NextResponse.json({ error: "Missing or invalid recognition." }, { status: 400 });
  }

  const {
    title,
    whoBecameVisible,
    story,
    virtueFamily,
    primaryVirtue,
    supportingVirtues,
    reflection,
    personalInsight,
    communityImpact,
    nextPractice,
    questionsToRevisit,
    conversationPath,
    contextType,
    context,
  } = recognition as Record<string, unknown>;

  if (
    typeof title !== "string" ||
    typeof whoBecameVisible !== "string" ||
    typeof story !== "string" ||
    typeof reflection !== "string" ||
    typeof personalInsight !== "string" ||
    typeof communityImpact !== "string" ||
    typeof virtueFamily !== "string" ||
    typeof primaryVirtue !== "string" ||
    !VIRTUE_FAMILIES.some((f) => f.key === virtueFamily) ||
    typeof conversationPath !== "string" ||
    !CONVERSATION_PATHS.includes(conversationPath as (typeof CONVERSATION_PATHS)[number]) ||
    typeof contextType !== "string" ||
    !CONTEXT_TYPES.includes(contextType as (typeof CONTEXT_TYPES)[number])
  ) {
    debugLog("2_validation", { result: "FAILED — missing or invalid required field" });
    return NextResponse.json({ error: "Missing or invalid required field." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: tokenRow, error: tokenLookupError } = await admin
    .from("oauth_access_tokens")
    .select("id, host_id, revoked_at, expires_at")
    .eq("access_token", accessToken)
    .maybeSingle();

  debugLog("3_oauth_token_validated", {
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

  // Same validation the website's own route applies: virtue names are
  // checked against the real Chemistry of Virtue rather than trusted as-is.
  const family = virtueFamily as VirtueFamilyKey;
  const supportingList = Array.isArray(supportingVirtues)
    ? supportingVirtues.filter((v): v is string => typeof v === "string")
    : [];
  const candidateNames = [primaryVirtue, ...supportingList].filter(Boolean);
  const virtueElements = candidateNames.filter((name) =>
    VIRTUES.some((v) => v.family === family && v.name.toLowerCase() === name.toLowerCase())
  );
  const validPrimary = VIRTUES.find(
    (v) => v.family === family && v.name.toLowerCase() === primaryVirtue.toLowerCase()
  );

  const contextObj = context && typeof context === "object" ? (context as Record<string, unknown>) : {};

  const { data: row, error: insertError } = await admin
    .from("recognitions")
    .insert({
      observer_id: hostId,
      observed_user_id: null,
      title,
      who_became_visible: whoBecameVisible,
      story,
      virtue_family: family,
      primary_virtue: validPrimary?.name ?? null,
      supporting_virtues: supportingList,
      virtue_elements: virtueElements,
      reflection,
      personal_insight: personalInsight,
      community_impact: communityImpact,
      next_practice: typeof nextPractice === "string" && nextPractice ? nextPractice : null,
      questions_to_revisit: Array.isArray(questionsToRevisit)
        ? questionsToRevisit.filter((q): q is string => typeof q === "string")
        : [],
      conversation_path: conversationPath,
      context_type: contextType,
      context_school: typeof contextObj.school === "string" ? contextObj.school : null,
      context_teacher: typeof contextObj.teacher === "string" ? contextObj.teacher : null,
      context_grade: typeof contextObj.grade === "string" ? contextObj.grade : null,
      context_business: typeof contextObj.business === "string" ? contextObj.business : null,
      context_organization: typeof contextObj.organization === "string" ? contextObj.organization : null,
      context_event: typeof contextObj.event === "string" ? contextObj.event : null,
    })
    .select("id")
    .single();

  debugLog("4_after_insert", {
    hostId,
    recognitionId: row?.id ?? null,
    result: insertError ? "FAILED" : "OK",
    insertError: insertError
      ? { message: insertError.message, details: insertError.details, hint: insertError.hint }
      : null,
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not save the workbook entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

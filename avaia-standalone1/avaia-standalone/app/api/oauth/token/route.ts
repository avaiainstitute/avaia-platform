import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// The token-exchange half of AVAIA's minimal OAuth provider. Called
// server-to-server by OpenAI's infrastructure (not the Host's browser) once
// the Host has approved /oauth/authorize. Trades a short-lived
// authorization code for a long-lived bearer access token, bound to the
// Host who approved it.
//
// Client credentials may arrive either as HTTP Basic auth (client_secret_basic)
// or in the request body (client_secret_post) — both are supported since
// which method GPT Builder's OAuth implementation actually uses isn't
// documented anywhere AVAIA controls.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function getClientCredentials(
  request: Request,
  body: Record<string, string>
): { clientId: string; clientSecret: string } {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice("Basic ".length), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex >= 0) {
      return {
        clientId: decoded.slice(0, separatorIndex),
        clientSecret: decoded.slice(separatorIndex + 1),
      };
    }
  }
  return { clientId: body.client_id ?? "", clientSecret: body.client_secret ?? "" };
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  const { clientId, clientSecret } = getClientCredentials(request, body);

  if (
    !process.env.GPT_OAUTH_CLIENT_ID ||
    !process.env.GPT_OAUTH_CLIENT_SECRET ||
    clientId !== process.env.GPT_OAUTH_CLIENT_ID ||
    clientSecret !== process.env.GPT_OAUTH_CLIENT_SECRET
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  if (body.grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const code = body.code;
  if (!code) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: authCode, error: lookupError } = await admin
    .from("oauth_authorization_codes")
    .select("id, host_id, client_id, redirect_uri, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();

  if (lookupError || !authCode || authCode.client_id !== clientId) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (authCode.used_at) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "code already used" },
      { status: 400 }
    );
  }
  if (new Date(authCode.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "code expired" },
      { status: 400 }
    );
  }
  if (body.redirect_uri && body.redirect_uri !== authCode.redirect_uri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "redirect_uri mismatch" },
      { status: 400 }
    );
  }

  await admin
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", authCode.id);

  const accessToken = randomBytes(32).toString("base64url");
  const { error: insertError } = await admin.from("oauth_access_tokens").insert({
    access_token: accessToken,
    host_id: authCode.host_id,
    client_id: clientId,
  });
  if (insertError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
  });
}

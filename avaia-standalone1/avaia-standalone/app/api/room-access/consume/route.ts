import { NextResponse } from "next/server";
import { consumePrivateAccessToken } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deliberately unauthenticated (by design -- there is no participant
 *  session yet at this point; the single-use token itself IS the
 *  credential, exactly like a password-reset or email-confirmation link).
 *  Never reachable from, or useful to, the Guide's own signed-in session --
 *  it returns only what the participant's own isolated client
 *  (lib/supabase/participant-client.ts) needs to call verifyOtp() itself. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const result = await consumePrivateAccessToken(token);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

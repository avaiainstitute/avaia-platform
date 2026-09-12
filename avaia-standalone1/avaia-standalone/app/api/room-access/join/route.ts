import { NextResponse } from "next/server";
import { consumeRoomInvitation } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deliberately unauthenticated, same posture as room-access/consume:
 *  the durable Room-join token IS the credential, there is no participant
 *  session yet. Mirrors consume/route.ts exactly, calling
 *  consumeRoomInvitation instead of consumePrivateAccessToken. Unlike that
 *  single-use token, this one stays valid for repeat visits (revoked only
 *  by the Guide), so a returning participant can reopen the same link. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body?.token;
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const result = await consumeRoomInvitation(token);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

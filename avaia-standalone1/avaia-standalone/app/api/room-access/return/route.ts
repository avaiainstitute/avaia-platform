import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { returnToRoomAsParticipant } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Called by the participant's own session (bearer token), never by the
 *  Guide. This is the only way a "brought_forward" choice can post
 *  anything into the shared Room -- the Guide's own session has no
 *  equivalent endpoint anymore (see the removed PATCH on
 *  /api/room/[roomId]/private). */
export async function POST(request: Request) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const roomPrivateSessionId: string | undefined = body?.roomPrivateSessionId;
  const choice: "keep_private" | "brought_forward" | undefined = body?.choice;
  const content: string | undefined = body?.content;
  if (!roomPrivateSessionId || !choice) {
    return NextResponse.json({ error: "Missing roomPrivateSessionId or choice." }, { status: 400 });
  }
  if (choice === "brought_forward" && !content?.trim()) {
    return NextResponse.json({ error: "Choose the exact wording to bring into the Room." }, { status: 400 });
  }

  const result = await returnToRoomAsParticipant(auth.userId, roomPrivateSessionId, choice, content);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { getRoomForParticipant } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A participant's own live view of a Room they're seated in, reached from
 *  app/room-join, never from the Guide's cookie session. Bearer-authenticated
 *  the same way app/api/room-access/* already is; getRoomForParticipant does
 *  its own seated-participant check (admin client, resolveSeatedParticipant)
 *  since rooms/room_participants/room_messages are Guide-owned by RLS and
 *  this caller's own token could never pass that RLS directly. */
export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await getRoomForParticipant(params.roomId, auth.userId);
  if ("error" in result) return NextResponse.json(result, { status: 403 });
  return NextResponse.json(result);
}

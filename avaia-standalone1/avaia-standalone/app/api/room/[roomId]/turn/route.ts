import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, recognizeTurn, clearFloor, listPendingTurnRequests } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Guide recognizes one raised hand, setting the visible floor signal.
 *  See lib/engine/room.ts's recognizeTurn: not a lock, just who the Room
 *  currently sees as speaking. */
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const room = await getRoom(supabase, params.roomId);
  if (!room || room.guide_id !== user.id) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId: string | undefined = body?.requestId;
  if (!requestId) return NextResponse.json({ error: "Missing requestId." }, { status: 400 });

  await recognizeTurn(supabase, params.roomId, requestId);
  const pendingTurnRequests = await listPendingTurnRequests(supabase, params.roomId);
  return NextResponse.json({ ok: true, pendingTurnRequests });
}

/** Clears the floor without recognizing anyone new. */
export async function DELETE(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const room = await getRoom(supabase, params.roomId);
  if (!room || room.guide_id !== user.id) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  await clearFloor(supabase, params.roomId);
  return NextResponse.json({ ok: true });
}

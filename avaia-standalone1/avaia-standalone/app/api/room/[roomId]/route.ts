import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRoom,
  listRoomParticipants,
  loadRoomMessages,
  listActivePrivateSessions,
  getRoomReferral,
} from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const room = await getRoom(supabase, params.roomId);
  // RLS already scopes getRoom to this Guide's own Rooms -- a mismatched
  // guide_id simply returns no row (403-shaped as 404, matching the
  // convention already used for a conversation not found in
  // /api/conversation).
  if (!room || room.guide_id !== user.id) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const [participants, messages, activePrivateSessions, referral] = await Promise.all([
    listRoomParticipants(supabase, room.id),
    loadRoomMessages(supabase, room.id),
    listActivePrivateSessions(supabase, room.id),
    room.status === "complete" ? getRoomReferral(supabase, room.id) : Promise.resolve(null),
  ]);

  return NextResponse.json({ room, participants, messages, activePrivateSessions, referral });
}

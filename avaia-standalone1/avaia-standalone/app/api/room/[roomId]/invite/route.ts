import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, getOrCreateRoomInvitation, revokeRoomInvitation } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates (or reuses) a durable Room-join link for one seated
 *  participant, the "normal flow" invitation from Part A: the Guide hands
 *  this to the participant, who opens it on their own device to enter the
 *  Room under their own identity. Distinct from /api/room/[roomId]/private,
 *  which starts a one-time private-processing session instead. */
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
  const participantId: string | undefined = body?.participantId;
  if (!participantId) return NextResponse.json({ error: "Missing participantId." }, { status: 400 });

  const origin = new URL(request.url).origin;
  const result = await getOrCreateRoomInvitation(supabase, params.roomId, participantId, origin);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

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

  const body = await request.json().catch(() => ({}));
  const participantId: string | undefined = body?.participantId;
  if (!participantId) return NextResponse.json({ error: "Missing participantId." }, { status: 400 });

  await revokeRoomInvitation(supabase, params.roomId, participantId);
  return NextResponse.json({ ok: true });
}

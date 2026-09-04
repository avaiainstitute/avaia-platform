import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, addParticipantToRoom, removeParticipantFromRoom } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnRoom(supabase: ReturnType<typeof createClient>, userId: string, roomId: string) {
  const room = await getRoom(supabase, roomId);
  return room && room.guide_id === userId ? room : null;
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await assertOwnRoom(supabase, user.id, params.roomId))) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const participantId: string | undefined = body?.participantId;
  if (!participantId) {
    return NextResponse.json({ error: "Missing participantId." }, { status: 400 });
  }

  const result = await addParticipantToRoom(supabase, params.roomId, participantId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await assertOwnRoom(supabase, user.id, params.roomId))) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const participantId: string | undefined = body?.participantId;
  if (!participantId) {
    return NextResponse.json({ error: "Missing participantId." }, { status: 400 });
  }

  await removeParticipantFromRoom(supabase, params.roomId, participantId);
  return NextResponse.json({ ok: true });
}

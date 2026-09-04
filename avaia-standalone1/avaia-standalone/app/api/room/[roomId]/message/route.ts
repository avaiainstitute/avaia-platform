import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, postRoomMessage } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (room.status !== "active") {
    return NextResponse.json({ error: "This Room is closed." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const speakerParticipantId: string | undefined = body?.speakerParticipantId;
  const message: string = (body?.message ?? "").toString().trim();
  if (!speakerParticipantId || !message) {
    return NextResponse.json({ error: "Missing speaker or message." }, { status: 400 });
  }

  try {
    const { reply, crisis } = await postRoomMessage(supabase, user.id, params.roomId, speakerParticipantId, message);
    return NextResponse.json({ reply, crisis });
  } catch (e) {
    console.error("AVAIA room message error:", e);
    return NextResponse.json({ error: "The Guide could not respond. Please try again." }, { status: 502 });
  }
}

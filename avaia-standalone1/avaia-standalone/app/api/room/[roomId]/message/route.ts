import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, postRoomMessage } from "@/lib/engine/room";
import { isAuthorizedGuideRoom } from "@/lib/guide";

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
  if (!(await isAuthorizedGuideRoom(supabase, user.id))) {
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
    if (crisis) {
      // Same oversight-only logging every other conversation surface
      // already does (app/api/conversation/route.ts, app/api/unsaid/
      // message/route.ts, app/api/unsung-heroes/message/route.ts,
      // app/api/room-access/message/route.ts) -- Rooms were the one gap.
      // conversation_id is null, a Room has no conversations row; host_id
      // is the Guide's own account, the same attribution the rest of the
      // Guide-facilitated architecture already uses when a participant has
      // no auth.users identity of their own to attribute to (this route is
      // a Guide relaying a participant's turn, RLS on crisis_events only
      // permits auth.uid() = host_id). No message content is stored here.
      await supabase.from("crisis_events").insert({ host_id: user.id, conversation_id: null });
    }
    return NextResponse.json({ reply, crisis });
  } catch (e) {
    console.error("AVAIA room message error:", e);
    return NextResponse.json({ error: "The Guide could not respond. Please try again." }, { status: 502 });
  }
}

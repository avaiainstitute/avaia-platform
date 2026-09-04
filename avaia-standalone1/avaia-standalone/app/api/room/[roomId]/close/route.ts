import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, closeRoom } from "@/lib/engine/room";

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
  if (room.status === "complete") {
    return NextResponse.json({ error: "This Room is already closed." }, { status: 409 });
  }

  const result = await closeRoom(supabase, user.id, params.roomId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, content: result.content });
}

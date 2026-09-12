import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, getRoomWorkbookForGuide, saveRoomMessageToWorkbookAsGuide, addRoomWorkbookNoteAsGuide } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Room's own curated Shared Workbook ("OURS"), never the Guide's or
 *  any Host's personal Workbook. See lib/engine/room.ts's own comment on
 *  this whole section for why it's two unioned sources, not one table. */
export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const room = await getRoom(supabase, params.roomId);
  if (!room || room.guide_id !== user.id) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const items = await getRoomWorkbookForGuide(supabase, params.roomId);
  return NextResponse.json({ items });
}

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
  const action = body?.action as "save_message" | "add_note" | undefined;

  if (action === "save_message") {
    const messageId: string | undefined = body?.messageId;
    if (!messageId) return NextResponse.json({ error: "Missing messageId." }, { status: 400 });
    const result = await saveRoomMessageToWorkbookAsGuide(supabase, params.roomId, messageId);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "add_note") {
    const content: string = (body?.content ?? "").toString();
    const result = await addRoomWorkbookNoteAsGuide(supabase, params.roomId, content);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unrecognized action." }, { status: 400 });
}

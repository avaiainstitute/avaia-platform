import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, startPrivateProcessing, returnToRoom } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts protected private processing for one participant. */
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

  const result = await startPrivateProcessing(supabase, user.id, params.roomId, participantId, room.program);
  return NextResponse.json(result);
}

/** Returns from private processing -- keep private, or bring specific
 *  wording forward into the shared Room. */
export async function PATCH(request: Request, { params }: { params: { roomId: string } }) {
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
  const roomPrivateSessionId: string | undefined = body?.roomPrivateSessionId;
  const choice: "keep_private" | "brought_forward" | undefined = body?.choice;
  const content: string | undefined = body?.content;
  if (!roomPrivateSessionId || !choice) {
    return NextResponse.json({ error: "Missing roomPrivateSessionId or choice." }, { status: 400 });
  }
  if (choice === "brought_forward" && !content?.trim()) {
    return NextResponse.json({ error: "Choose the exact wording to bring into the Room." }, { status: 400 });
  }

  try {
    const result = await returnToRoom(supabase, user.id, roomPrivateSessionId, choice, content);
    return NextResponse.json(result);
  } catch (e) {
    console.error("AVAIA room return-to-room error:", e);
    return NextResponse.json({ error: "Could not return to the Room. Please try again." }, { status: 502 });
  }
}

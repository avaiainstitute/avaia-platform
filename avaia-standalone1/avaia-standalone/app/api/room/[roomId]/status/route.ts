import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, pauseRoom, reopenRoom, archiveRoom, unarchiveRoom } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = {
  pause: pauseRoom,
  reopen: reopenRoom,
  archive: archiveRoom,
  unarchive: unarchiveRoom,
} as const;

/** A Room's lifecycle beyond the binary active/complete Close Room button:
 *  pause (still readable, not accepting new turns), reopen (back to
 *  active from paused OR complete, history intact either way), archive
 *  and unarchive. Every transition is reversible and never touches
 *  room_messages, see lib/engine/room.ts's own comment on this section. */
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
  const action = body?.action as keyof typeof ACTIONS | undefined;
  if (!action || !(action in ACTIONS)) {
    return NextResponse.json({ error: "Unrecognized action." }, { status: 400 });
  }

  await ACTIONS[action](supabase, params.roomId);
  return NextResponse.json({ ok: true });
}

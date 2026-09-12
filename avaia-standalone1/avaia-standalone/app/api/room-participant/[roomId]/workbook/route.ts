import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import {
  getRoomWorkbookForParticipant,
  saveRoomMessageToWorkbookAsParticipant,
  addRoomWorkbookNoteAsParticipant,
} from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A seated participant's own view of, and additions to, their Room's
 *  Shared Workbook ("OURS"). This is never their personal Workbook, and
 *  nothing here reaches any other participant's private conversation,
 *  see lib/engine/room.ts's own comment on this section. */
export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await getRoomWorkbookForParticipant(params.roomId, auth.userId);
  if ("error" in result) return NextResponse.json(result, { status: 403 });
  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action as "save_message" | "add_note" | undefined;

  if (action === "save_message") {
    const messageId: string | undefined = body?.messageId;
    if (!messageId) return NextResponse.json({ error: "Missing messageId." }, { status: 400 });
    const result = await saveRoomMessageToWorkbookAsParticipant(params.roomId, auth.userId, messageId);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "add_note") {
    const content: string = (body?.content ?? "").toString();
    const result = await addRoomWorkbookNoteAsParticipant(params.roomId, auth.userId, content);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unrecognized action." }, { status: 400 });
}

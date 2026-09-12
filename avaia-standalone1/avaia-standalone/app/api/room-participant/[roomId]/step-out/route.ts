import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { startPrivateProcessingForParticipant, type RoomContextSelection } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A participant choosing, themselves, to step into a private conversation
 *  from inside the Room they're already in, on their own device, no Guide
 *  action required. `contextSelection` is the participant's own explicit
 *  choice of what (if anything) to bring with them, see RoomContextSelection,
 *  never an automatic dump of the shared thread. The returned accessUrl is
 *  the same one-time link the Guide-initiated flow produces; the client
 *  simply navigates this same tab to it, handing off to the existing
 *  app/room-access/[token] private-processing page. */
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const selection: RoomContextSelection = isValidSelection(body?.contextSelection)
    ? body.contextSelection
    : { mode: "none" };

  const origin = new URL(request.url).origin;

  try {
    const result = await startPrivateProcessingForParticipant(params.roomId, auth.userId, origin, selection);
    if ("error" in result) return NextResponse.json(result, { status: 409 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("AVAIA room-participant step-out error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start private processing." },
      { status: 502 }
    );
  }
}

function isValidSelection(value: unknown): value is RoomContextSelection {
  if (!value || typeof value !== "object") return false;
  const mode = (value as { mode?: unknown }).mode;
  if (mode === "none" || mode === "all") return true;
  if (mode === "own") return typeof (value as { participantId?: unknown }).participantId === "string";
  if (mode === "messageIds") {
    const ids = (value as { messageIds?: unknown }).messageIds;
    return Array.isArray(ids) && ids.every((id) => typeof id === "string");
  }
  return false;
}

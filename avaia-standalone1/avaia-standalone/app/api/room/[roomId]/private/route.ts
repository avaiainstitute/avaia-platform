import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoom, startPrivateProcessing } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts protected private processing for one participant. Returns a
 *  one-time access URL only -- never the conversation itself. The Guide's
 *  own session has no way to read what happens at that URL; it's meant to
 *  be handed to the participant and opened in their own browser context
 *  (their own device, or a private/incognito window -- never the Guide's
 *  own signed-in tab, which would only ever see "link generated," nothing
 *  more). See lib/engine/room.ts's startPrivateProcessing for why. */
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

  try {
    const result = await startPrivateProcessing(supabase, params.roomId, participantId, room.program, origin);
    return NextResponse.json(result);
  } catch (e) {
    console.error("AVAIA room private-processing error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start private processing." },
      { status: 502 }
    );
  }
}

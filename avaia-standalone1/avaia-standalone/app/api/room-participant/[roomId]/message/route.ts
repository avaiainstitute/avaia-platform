import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { postRoomMessageAsParticipant } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A participant speaking in the shared Room thread, from their own
 *  device, in their own name, no Guide relay. See Part A/B: this is the
 *  route that makes "everyone can read but only one posts through the
 *  Guide" no longer true, every seated participant can post here. */
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content: string = (body?.content ?? "").toString().trim();
  if (!content) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });

  const result = await postRoomMessageAsParticipant(params.roomId, auth.userId, content);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { suggestBringForward } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Offers one possible way to word what to bring forward, called only
 *  when the participant themselves asks for it (see the "Help me find the
 *  words" button in app/room-access/[token]/page.tsx). Bearer-authenticated
 *  exactly like /api/room-access/message: the same isolated participant
 *  session, RLS-scoped to their own conversation, invisible to the Guide. */
export async function POST(request: Request) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation." }, { status: 400 });
  }

  const result = await suggestBringForward(supabase, userId, conversationId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ suggestion: result.suggestion });
}

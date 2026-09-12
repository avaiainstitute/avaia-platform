import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { requestTurn, withdrawTurnRequest } from "@/lib/engine/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Raise a hand. Simple, see requestTurn's own comment: this is a signal
 *  for the Guide to recognize, never a lock on who may speak. */
export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await requestTurn(params.roomId, auth.userId);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

/** Lower a hand, either changed their mind or spoke anyway. */
export async function DELETE(request: Request, { params }: { params: { roomId: string } }) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await withdrawTurnRequest(params.roomId, auth.userId);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

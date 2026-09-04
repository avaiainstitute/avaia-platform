import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isToolkitAuthorized } from "@/lib/guide";
import { createRoom, listRooms } from "@/lib/engine/room";
import type { Program } from "@/lib/engine/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const rooms = await listRooms(supabase, user.id);
  return NextResponse.json({ rooms });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await isToolkitAuthorized(supabase, user.id))) {
    return NextResponse.json({ error: "Toolkit authorization required to create a Room." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const program: Program = ["general", "defying-grief", "youth"].includes(body?.program)
    ? body.program
    : "general";

  const room = await createRoom(supabase, user.id, program);
  return NextResponse.json({ room });
}

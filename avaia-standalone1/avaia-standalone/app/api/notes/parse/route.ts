import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractNoteFields } from "@/lib/ops/founder-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only, same-origin, AI-assist for Follow-up Memory / After-Meeting
// Capture (Round 4). Proposes structured fields from Dorian's own raw text
// for review in the browser -- writes nothing to the database itself; the
// admin UI's own save action (app/admin/notes/page.tsx) is what persists
// whatever Dorian actually confirms.

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind = body?.kind;
  const rawText = String(body?.rawText ?? "").trim();
  if ((kind !== "follow_up" && kind !== "meeting_note") || !rawText) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const extraction = await extractNoteFields(kind, rawText);
  if (!extraction) {
    return NextResponse.json({ error: "extraction_failed" }, { status: 502 });
  }
  return NextResponse.json({ extraction });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { keepFromJourney, keepFromRecognition } from "@/lib/ops/kept-items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Keep this" on one of the signed-in Host's OWN items: a Journey item or an Unsung Heroes
 *  recognition. The browser sends only which item; the text is read from the stored record
 *  server-side, through the Host's own RLS-bound client, so a Host can only keep what is
 *  theirs and a client can never supply or alter the kept text. Runs only on the Host's own
 *  click; nothing is ever kept automatically. A Guide-run session's items never come
 *  through here: they reach the Host only as an offer the Host confirms (see /workbook/from-guides). */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const source = String(body?.source ?? "");
  let result;
  if (source === "journey") {
    result = await keepFromJourney(supabase, user.id, String(body?.conversationId ?? ""), String(body?.field ?? ""), Number(body?.index));
  } else if (source === "recognition") {
    result = await keepFromRecognition(supabase, user.id, String(body?.recognitionId ?? ""));
  } else {
    return NextResponse.json({ error: "Unknown source." }, { status: 400 });
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

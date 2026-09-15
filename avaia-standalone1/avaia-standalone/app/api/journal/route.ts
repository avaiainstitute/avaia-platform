import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJournalEntry, type JournalContext, type JournalEntryMethod } from "@/lib/journal";
import { detectCrisis } from "@/lib/engine/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// AVAIA Journal, entry creation. Deliberately the simplest route in this
// codebase's conversation-adjacent family: no AI call of any kind, no
// reply generated, no interpretation. Saves exactly what the Host wrote
// or (via MicButton + /api/transcript-cleanup, already applied client-
// side before this route ever sees the text) faithfully transcribed.
//
// The one exception, matching the established pattern on every other
// private capture surface (IAP/CAT/InnerCompass, Unsaid, Unsung Heroes,
// Shared Room messages): a metadata-only crisis_events row when the same
// deterministic detectCrisis() pattern already used everywhere else
// trips. This never generates a response, never blocks the save, and
// never stores or exposes entry content anywhere crisis_events doesn't
// already store it for every other surface (host_id + timestamp only).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const content: string = (body?.content ?? "").toString().trim();
  const entryMethodRaw = (body?.entryMethod ?? "").toString();
  const context = (body?.context ?? null) as JournalContext | null;

  if (!content) return NextResponse.json({ error: "Write or say something first." }, { status: 400 });
  const entryMethod: JournalEntryMethod = entryMethodRaw === "talk" ? "talk" : "write";
  const validContext: JournalContext | null =
    context && (context.source === "prompt" || context.source === "program") && typeof context.label === "string"
      ? { source: context.source, label: context.label }
      : null;

  const { entry, error } = await createJournalEntry(supabase, user.id, content, entryMethod, validContext);
  if (error || !entry) {
    console.error("AVAIA Journal: failed to save entry:", error);
    return NextResponse.json({ error: "Could not save your entry. Please try again." }, { status: 500 });
  }

  if (detectCrisis(content)) {
    await supabase.from("crisis_events").insert({ host_id: user.id, conversation_id: null });
  }

  return NextResponse.json({ entry });
}

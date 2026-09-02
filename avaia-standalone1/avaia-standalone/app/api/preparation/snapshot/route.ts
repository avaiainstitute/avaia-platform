import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantHistory } from "@/lib/guide";
import { generateParticipantSnapshot } from "@/lib/engine/preparation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guide-only, session-authenticated (not the external GPT-Actions bearer-
// token pattern -- Preparation is an in-app Guide Toolkit feature, not an
// external ChatGPT integration; see lib/toolkit.ts's existing "installed"
// preparation entry and app/toolkit/preparation/[participantId]/page.tsx,
// the real production surface this powers).
//
// Authorization is identical to, and reuses, the existing Preparation page's
// own check: getParticipantHistory(supabase, callerId, participantId) only
// ever returns a participant row scoped to `guide_id = callerId`
// (lib/guide.ts) -- there is no separate authorization mechanism to keep in
// sync, and no way for this route to see a participant that doesn't already
// belong to the calling Guide. participantId is the only client input; the
// Host evidence itself is always re-derived server-side from that
// authorized lookup, never trusted from the request body.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const participantId: string | undefined = body?.participantId;
  if (!participantId) return NextResponse.json({ error: "Missing participant." }, { status: 400 });

  const history = await getParticipantHistory(supabase, user.id, participantId);
  if (!history) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  const result = await generateParticipantSnapshot(history, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ snapshot: result.snapshot });
}

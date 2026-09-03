import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantHistory } from "@/lib/guide";
import { generatePreparationChatReply, type PreparationChatTurn } from "@/lib/engine/preparation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The interactive Preparation workspace's backing route -- same
// authorization posture as /api/preparation/snapshot (Guide-only,
// session-authenticated, ownership enforced entirely through
// getParticipantHistory's own guide_id scoping, participantId the only
// client input that reaches a database lookup). guideMessage and
// priorTurns are the Guide's own typed conversation; they're never
// persisted here (this workspace is ephemeral by design -- it prepares
// the Guide for the next Host conversation, it isn't itself part of any
// continuity record) and never reach the Host's own Workbook or referral
// data in either direction.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const participantId: string | undefined = body?.participantId;
  const guideMessage: string = (body?.message ?? "").toString().trim();
  const priorTurns: PreparationChatTurn[] = Array.isArray(body?.priorTurns)
    ? body.priorTurns
        .filter((t: any) => t && (t.role === "guide" || t.role === "preparation") && typeof t.content === "string")
        .map((t: any) => ({ role: t.role, content: t.content }))
    : [];

  if (!participantId) return NextResponse.json({ error: "Missing participant." }, { status: 400 });
  if (!guideMessage) return NextResponse.json({ error: "Missing message." }, { status: 400 });

  const history = await getParticipantHistory(supabase, user.id, participantId);
  if (!history) return NextResponse.json({ error: "Participant not found." }, { status: 404 });

  // Canonical published activities the reply is allowed to reference --
  // fetched here (not inside lib/engine/preparation.ts, which never
  // queries the database itself) and handed in as plain text, the same
  // "caller loads it, engine only reasons over it" split the rest of this
  // module already follows.
  const [{ data: classes }, { data: experiences }] = await Promise.all([
    supabase.from("classes").select("title, family, summary").eq("status", "published").order("title"),
    supabase.from("experiences").select("title, summary").eq("status", "published").order("title"),
  ]);
  const activityLines = [
    ...(experiences ?? []).map((e) => `- [Experience] ${e.title}${e.summary ? ` — ${e.summary}` : ""}`),
    ...(classes ?? []).map((c) => `- [Class, ${c.family}] ${c.title}${c.summary ? ` — ${c.summary}` : ""}`),
  ];

  const result = await generatePreparationChatReply(
    history,
    user.id,
    activityLines.join("\n"),
    priorTurns,
    guideMessage
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

  return NextResponse.json({ reply: result.reply });
}

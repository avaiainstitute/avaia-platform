import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addSignatureEntryForHost,
  addSignatureEntryForParticipant,
  type SignatureLayer,
  type SignatureSourceType,
} from "@/lib/virtue-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LAYERS: SignatureLayer[] = [
  "recognize_in_myself",
  "others_noticed",
  "qualities_together",
  "different_expressions",
  "want_to_practice",
  "want_to_contribute",
];
const VALID_SOURCES: SignatureSourceType[] = ["self", "conversation_referral", "unsung_heroes", "observation_offered"];

/** The "Consider for My Virtue Signature" action -- components/
 *  WhatBecameVisible.tsx (Journey completion card, Unsung Heroes) posts
 *  here, both from a self-serve Host's own conversation and from a
 *  Guide-facilitated one. An optional participantId in the body routes to
 *  the participant's own Signature (addSignatureEntryForParticipant,
 *  ownership re-checked here rather than trusted from the client) instead
 *  of the signed-in user's -- without it, a Guide running a session on a
 *  Youth participant's behalf would otherwise have the recognition land in
 *  the Guide's own personal Signature, which is what this route did before
 *  this check existed. Nothing here is ever automatic -- this route only
 *  ever runs from the Host's (or Guide's, on the participant's behalf) own
 *  explicit click. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const layer = body?.layer;
  const family: string = (body?.family ?? "").toString();
  const element: string | null = body?.element ? body.element.toString() : null;
  const sourceType = body?.sourceType;
  const sourceReference: string | null = body?.sourceReference ? body.sourceReference.toString() : null;
  const participantId: string | null = body?.participantId ? body.participantId.toString() : null;

  if (!VALID_LAYERS.includes(layer) || !family) {
    return NextResponse.json({ error: "Missing layer or family." }, { status: 400 });
  }
  const resolvedSource: SignatureSourceType = VALID_SOURCES.includes(sourceType) ? sourceType : "self";

  if (participantId) {
    const { data: participant } = await supabase
      .from("guide_participants")
      .select("id, guide_id")
      .eq("id", participantId)
      .maybeSingle();
    if (!participant || participant.guide_id !== user.id) {
      return NextResponse.json({ error: "Not authorized for this participant." }, { status: 403 });
    }
    const { error } = await addSignatureEntryForParticipant(
      supabase,
      participantId,
      layer,
      family,
      element,
      null,
      resolvedSource,
      sourceReference
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await addSignatureEntryForHost(
    supabase,
    user.id,
    layer,
    family,
    element,
    null,
    resolvedSource,
    sourceReference
  );
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

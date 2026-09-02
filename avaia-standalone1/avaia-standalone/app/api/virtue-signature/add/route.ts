import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addSignatureEntryForHost, type SignatureLayer, type SignatureSourceType } from "@/lib/virtue-signature";

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
 *  here. Self-serve Host only; a Guide-facilitated participant's
 *  equivalent action goes through the Guide's own server actions (RLS-
 *  scoped to their own participants), not this route. Nothing here is
 *  ever automatic -- this route only ever runs from the Host's own
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

  if (!VALID_LAYERS.includes(layer) || !family) {
    return NextResponse.json({ error: "Missing layer or family." }, { status: 400 });
  }
  const resolvedSource: SignatureSourceType = VALID_SOURCES.includes(sourceType) ? sourceType : "self";

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

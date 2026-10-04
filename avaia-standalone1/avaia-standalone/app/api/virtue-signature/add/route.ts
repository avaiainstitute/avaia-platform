import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addSignatureEntryForHost,
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
const VALID_SOURCES: SignatureSourceType[] = [
  "self",
  "conversation_referral",
  "unsung_heroes",
  "observation_offered",
  "journal",
];

/** The "Consider for My Virtue Signature" action, components/
 *  WhatBecameVisible.tsx (Journey completion card, Unsung Heroes) posts
 *  here from a Host's own conversation, and only ever lands on the signed-in
 *  Host's OWN Signature. A request that names a participant (a Guide acting
 *  for someone else) is refused: a Guide must never place a participant's
 *  material in a record the Guide controls. Nothing here is ever automatic,
 *  this route only ever runs from the Host's own explicit click. */
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
  // addSignatureEntryForHost/ForParticipant already accept a note (the
  // Host's own words for why/how this became visible to them); this route
  // just never read one from the request body before -- every existing
  // caller (WhatBecameVisible.tsx) never sent one, so passing it through
  // now changes nothing for them.
  const note: string | null = body?.note ? body.note.toString().trim() || null : null;

  if (!VALID_LAYERS.includes(layer) || !family) {
    return NextResponse.json({ error: "Missing layer or family." }, { status: 400 });
  }
  const resolvedSource: SignatureSourceType = VALID_SOURCES.includes(sourceType) ? sourceType : "self";

  // A Guide may never place a participant's material in a Virtue Signature (Move 7). That
  // would put the participant's recognition in a record the Guide controls, as though it were
  // the participant's own continuity. A Guide can only OFFER an item back to the participant
  // (Keep this); the participant builds their own Signature. The database has no Guide write
  // policy on the participant's Signature either, so this is refused in two places.
  if (participantId) {
    return NextResponse.json(
      { error: "A Guide cannot add to a participant's Virtue Signature. Offer the item to them instead, and they decide what to keep." },
      { status: 403 }
    );
  }

  const { error } = await addSignatureEntryForHost(
    supabase,
    user.id,
    layer,
    family,
    element,
    note,
    resolvedSource,
    sourceReference
  );
  if (error) return NextResponse.json({ error }, { status: 400 });

  return NextResponse.json({ ok: true });
}

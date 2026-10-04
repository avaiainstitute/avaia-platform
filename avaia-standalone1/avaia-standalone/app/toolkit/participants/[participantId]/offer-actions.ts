"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { offerItems, withdrawOffer, type OfferRequest } from "@/lib/ops/kept-items";

// A Guide OFFERS an item from one of their own sessions back to the participant, or takes
// back an offer that is still waiting. That is all a Guide can do. Offering is not deciding:
// the participant confirms the session is theirs, sees the item, and chooses whether to keep
// it. The Guide is never told what they chose, and can never write the participant's record.

async function requireGuide() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");
  return { supabase, userId: user.id };
}

function back(participantId: string, kind: "offered" | "offerError", message: string): never {
  redirect(`/toolkit/participants/${participantId}?${kind}=${encodeURIComponent(message)}`);
}

export async function offerItemsAction(formData: FormData) {
  const participantId = String(formData.get("participantId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const { supabase, userId } = await requireGuide();
  if (!participantId) redirect("/toolkit");

  const items: OfferRequest[] = [];
  for (const raw of formData.getAll("item")) {
    const value = String(raw);
    if (value.startsWith("recognition:")) {
      items.push({ kind: "recognition", recognitionId: value.slice("recognition:".length) });
    } else if (value.startsWith("field:")) {
      const [, field, index] = value.split(":");
      items.push({ kind: "field", field: field ?? "", index: Number(index) });
    }
  }
  const result = await offerItems({ supabase, guideId: userId, participantId, sessionId, items });
  if (!result.ok) back(participantId, "offerError", result.error);
  back(
    participantId,
    "offered",
    `Offered ${result.offered} item${result.offered === 1 ? "" : "s"}${result.alreadyOffered > 0 ? ` (${result.alreadyOffered} were already offered)` : ""}. They decide whether to keep any of it.`
  );
}

export async function withdrawOfferAction(formData: FormData) {
  const participantId = String(formData.get("participantId") ?? "");
  const { supabase } = await requireGuide();
  if (!participantId) redirect("/toolkit");
  const result = await withdrawOffer(supabase, String(formData.get("offerId") ?? ""));
  if (!result.ok) back(participantId, "offerError", result.error);
  back(participantId, "offered", "Offer withdrawn.");
}

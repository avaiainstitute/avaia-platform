// Plain types/constants only -- deliberately NOT server-only, unlike
// lib/virtue-signature.ts (which re-exports these for server code's
// convenience). components/VirtueSignatureVisual.tsx is a client
// component and needs IDENTITY_FIRST_RING as a real runtime value, not
// just a type -- importing it (even alongside a type-only import) from a
// "server-only" module fails the build ("You're importing a component
// that needs server-only"), the same reason lib/youth-assent-text.ts was
// split out of lib/guardian-consent.ts earlier in this build. Splitting
// this out once, here, avoids that same mistake everywhere else this data
// is needed client-side.

export type SignatureLayer =
  | "recognize_in_myself"
  | "others_noticed"
  | "qualities_together"
  | "different_expressions"
  | "want_to_practice"
  | "want_to_contribute";

export const SIGNATURE_LAYER_LABEL: Record<SignatureLayer, string> = {
  recognize_in_myself: "What I Recognize in Myself",
  others_noticed: "What Other People Have Noticed",
  qualities_together: "How My Qualities Work Together",
  different_expressions: "Different Ways the Same Quality Can Show Up",
  want_to_practice: "What I Want to Practice",
  want_to_contribute: "How I Want to Contribute",
};

export const SIGNATURE_LAYER_ORDER: SignatureLayer[] = [
  "recognize_in_myself",
  "others_noticed",
  "qualities_together",
  "different_expressions",
  "want_to_practice",
  "want_to_contribute",
];

export type SignatureSourceType = "self" | "conversation_referral" | "unsung_heroes" | "observation_offered";

export type VirtueSignatureEntry = {
  id: string;
  host_id: string | null;
  guide_participant_id: string | null;
  layer: SignatureLayer;
  family: string;
  element: string | null;
  note: string | null;
  source_type: SignatureSourceType;
  source_reference: string | null;
  status: "active" | "removed";
  created_at: string;
  updated_at: string;
};

/** The two elements the recovered source material names as Identity's
 *  fixed first ring -- both already-canonical Integrity elements
 *  (confirmed against lib/virtues.ts before this was written), never
 *  something a Host adds or removes themselves. Every other ring is the
 *  Host's own living, editable record. */
export const IDENTITY_FIRST_RING: { family: string; element: string }[] = [
  { family: "Integrity", element: "Vulnerability" },
  { family: "Integrity", element: "Authenticity" },
];

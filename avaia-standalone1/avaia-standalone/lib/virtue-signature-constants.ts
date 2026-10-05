// Plain types/constants only, deliberately NOT server-only, unlike
// lib/virtue-signature.ts (which re-exports these for server code's
// convenience). components/VirtueSignatureVisual.tsx is a client
// component and needs IDENTITY_FIRST_RING as a real runtime value, not
// just a type, importing it (even alongside a type-only import) from a
// "server-only" module fails the build ("You're importing a component
// that needs server-only"), the same reason lib/youth-assent-text.ts was
// split out of lib/guardian-consent.ts earlier in this build. Splitting
// this out once, here, avoids that same mistake everywhere else this data
// is needed client-side.
//
// FOUNDER-GOVERNED STRUCTURE (reconciled 2026-10-04):
//   center / nucleus   YOU / IDENTITY
//   first ring         VULNERABILITY + AUTHENTICITY (they surround and protect identity)
//   next ring          may hold up to eight virtue elements that become visible
//   additional rings   the Signature may keep becoming visible as more elements / patterns emerge
// A Virtue Signature becomes visible through REPEATED EXPERIENCES + REPEATED EXPRESSIONS +
// DIFFERENT SCENARIOS. It is not a one-time list a person picked.
//
// There used to be six "layers" (What I Recognize in Myself ... How I Want to Contribute).
// Their only source was two AI/script-generated documents saved on 26-27 August 2026; no
// earlier Founder source exists, no reason for the number six is given, and nothing ties
// them to the atom. They are NOT Virtue Signature architecture and have been removed from
// the active implementation. The database column still exists (nullable, retired) so
// nothing historical is destroyed.

export type SignatureSourceType =
  | "self"
  | "conversation_referral"
  | "unsung_heroes"
  | "observation_offered"
  | "journal";

export type VirtueSignatureEntry = {
  id: string;
  host_id: string | null;
  guide_participant_id: string | null;
  /** Retired. Never read or written by the application; the column is kept only so that
   *  nothing historical is destroyed. */
  layer?: string | null;
  family: string;
  element: string | null;
  /** The Host's own words: the experience or scenario where this became visible. */
  note: string | null;
  source_type: SignatureSourceType;
  source_reference: string | null;
  status: "active" | "removed";
  created_at: string;
  updated_at: string;
};

/** The two elements the Founder's own account names as Identity's first ring, both
 *  already-canonical Integrity elements (confirmed against lib/virtues.ts), never
 *  something a Host adds or removes themselves. */
export const IDENTITY_FIRST_RING: { family: string; element: string }[] = [
  { family: "Integrity", element: "Vulnerability" },
  { family: "Integrity", element: "Authenticity" },
];

/** The Founder's description of the ring after the first: it "may hold up to eight". No
 *  capacity is established for any ring beyond it, and none is invented here. */
export const NEXT_RING_CAPACITY = 8;

/** One virtue (family + optional element) together with every recorded experience or
 *  expression of it. Repetition across different scenarios is the pattern; this simply
 *  keeps those entries together. There is deliberately no count threshold, score or
 *  "enough" test anywhere. */
export type SignatureElement = {
  key: string;
  family: string;
  element: string | null;
  entries: VirtueSignatureEntry[];
};

export function groupByElement(entries: VirtueSignatureEntry[]): SignatureElement[] {
  const groups = new Map<string, SignatureElement>();
  for (const e of entries) {
    const key = `${e.family.toLowerCase()}|${(e.element ?? "").toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) existing.entries.push(e);
    else groups.set(key, { key, family: e.family, element: e.element, entries: [e] });
  }
  return [...groups.values()];
}

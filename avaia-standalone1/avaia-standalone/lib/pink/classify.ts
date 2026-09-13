// Deterministic, fixed-rule classification for the Pink Shoelace contact
// form. Modeled on the same posture already established in
// lib/engine/finish-intent.ts and lib/engine/anthropic.ts's detectCrisis --
// AVAIA's own precedent for anything that triggers a real action (here:
// deciding whether a message needs Dorian personally) is a small set of
// fixed, auditable patterns, not a live model call. A false "needs_dorian"
// costs Dorian one extra look at a message that turned out to be routine;
// a false negative means something that should have reached him doesn't.
// That asymmetry is why this stays deterministic, and why it reuses
// detectCrisis rather than re-implementing safety detection a second time.
//
// This module NEVER drafts a reply. It only assigns a category and a
// needs_dorian/follow_up_needed judgment; the actual acknowledgment text
// sent back to the person is a fixed template per category (see
// lib/pink/emails.ts), so nothing here can invent a commitment, a price,
// or a policy AVAIA/Pink Shoelace hasn't actually established.

import { detectCrisis } from "@/lib/engine/anthropic";

export type PinkContactCategory =
  | "general"
  | "partnership"
  | "media_press"
  | "volunteer_or_donate"
  | "other";

export type PinkContactClassification = {
  category: PinkContactCategory;
  needsDorian: boolean;
  followUpNeeded: boolean;
};

const PARTNERSHIP_PATTERNS =
  /\b(partner|partnership|school|hospital|sports team|sports organization|our organization|collaborat|sponsor(?:ship)?\b(?!.*donat))\b/i;

const MEDIA_PATTERNS = /\b(press|media|journalist|reporter|article|interview|story about|podcast)\b/i;

const VOLUNTEER_DONATE_PATTERNS = /\b(volunteer|donat(?:e|ion)|fundrais|give back|contribut(?:e|ion))\b/i;

// A direct question deserves a human look rather than a purely automated
// close, when the category isn't already one that always routes to Dorian
// below.
const QUESTION_PATTERN = /\?/;

export function classifyPinkContact(message: string): PinkContactClassification {
  const text = message.toLowerCase();

  let category: PinkContactCategory = "general";
  if (PARTNERSHIP_PATTERNS.test(text)) category = "partnership";
  else if (MEDIA_PATTERNS.test(text)) category = "media_press";
  else if (VOLUNTEER_DONATE_PATTERNS.test(text)) category = "volunteer_or_donate";

  // Institutional/relationship categories always reach Dorian personally --
  // an automated acknowledgment is still sent (see lib/pink/emails.ts), but
  // nothing about partnership, media, or a donation/volunteer offer is ever
  // resolved by this route alone.
  const alwaysNeedsDorian = category === "partnership" || category === "media_press" || category === "volunteer_or_donate";

  const needsDorian = alwaysNeedsDorian || detectCrisis(message) || QUESTION_PATTERN.test(message);
  const followUpNeeded = alwaysNeedsDorian;

  return { category, needsDorian, followUpNeeded };
}

export type PinkParticipationInterestType =
  | "wear_shoelace"
  | "walk_alongside"
  | "honor_someone"
  | "foundation_participation"
  | "other";

/** Participation requests are captured with an explicit interest_type from
 *  the form itself (a select/radio, once one exists -- see
 *  docs/PINK_INTEGRATION.md), not classified from free text, so there is no
 *  ambiguity to resolve here. honor_someone always reaches Dorian
 *  personally; nothing about a specific loss is ever auto-resolved. */
export function participationNeedsDorian(interestType: PinkParticipationInterestType): boolean {
  return interestType === "honor_someone" || interestType === "foundation_participation" || interestType === "other";
}

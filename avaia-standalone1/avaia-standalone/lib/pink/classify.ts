// Deterministic, fixed-rule classification for the Pink Shoelace contact
// form. Modeled on the same posture already established in
// lib/engine/finish-intent.ts and lib/engine/anthropic.ts's detectCrisis --
// AVAIA's own precedent for anything that triggers a real action (here:
// deciding whether a message needs Dorian personally) is a small set of
// fixed, auditable patterns, not a live model call.

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

const QUESTION_PATTERN = /\?/;

export function classifyPinkContact(message: string): PinkContactClassification {
  const text = message.toLowerCase();

  let category: PinkContactCategory = "general";
  if (PARTNERSHIP_PATTERNS.test(text)) category = "partnership";
  else if (MEDIA_PATTERNS.test(text)) category = "media_press";
  else if (VOLUNTEER_DONATE_PATTERNS.test(text)) category = "volunteer_or_donate";

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

export function participationNeedsDorian(interestType: PinkParticipationInterestType): boolean {
  return interestType === "honor_someone" || interestType === "foundation_participation" || interestType === "other";
}

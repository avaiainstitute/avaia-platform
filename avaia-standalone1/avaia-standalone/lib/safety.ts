// Safety, consent, and crisis content — approved by Dorian Johnson
// (Answers to AVAIA remaining questions, 2026-07-10). This is the canonical
// wording for the live conversation engine (login + IAP → CAT → InnerCompass).
// Kept here so it is version-controlled and used verbatim when the engine ships.

/** Bump when the disclaimer wording changes; recorded on each Host's profile. */
export const DISCLAIMER_VERSION = "2026-07-10";

/** Shown before a Host begins (approved wording, Q3). */
export const DISCLAIMER =
  "AVAIA provides guided, virtue-centered conversations designed to support awareness, understanding, discernment, and intentional participation in life. AVAIA is not therapy, counseling, medical care, legal advice, or crisis intervention, and it does not diagnose or treat any condition. You remain the owner of your story and every decision you make. If you are experiencing a crisis or believe you may be at risk of harming yourself or someone else, immediately contact emergency services or your local crisis resources, including calling or texting 988 within the United States.";

/**
 * Crisis protocol (approved, Q1). On detection the AI steps outside the normal
 * flow, responds with warmth and compassion, acknowledges the need for
 * immediate human support, provides resources, and remains present — without
 * counseling, diagnosing, or attempting to resolve the crisis.
 */
export const CRISIS_PROTOCOL = {
  detects: [
    "suicidal ideation or intent",
    "intent to harm others",
    "abuse",
    "severe psychiatric symptoms",
    "medical emergency",
  ],
  behavior:
    "Temporarily step outside the normal conversation flow. Respond with warmth and compassion. Acknowledge that the situation requires immediate human support. Provide the appropriate crisis resources. Remain present without attempting to counsel, diagnose, or resolve the crisis.",
} as const;

/**
 * Crisis resources. US is the initial implementation (Q2); the platform is
 * designed so organizations in other regions can configure their own resources
 * without changing the architecture.
 */
export const CRISIS_RESOURCES = {
  US: [
    { label: "988 Suicide & Crisis Lifeline", detail: "Call or text 988" },
    { label: "Emergency", detail: "Call 911 for immediate danger" },
    { label: "Crisis Text Line", detail: "Text HOME to 741741" },
  ],
} as const;

/** Eligibility & human-referral policy (Q4). */
export const ELIGIBILITY = {
  intendedFor: "adults",
  minors:
    "Individuals under 18 should participate only with the involvement and consent of a parent, guardian, or sponsoring organization with appropriate policies in place.",
  recommendHumanWhen: [
    "significant crisis concerns",
    "abuse",
    "active suicidal or homicidal intent",
    "severe psychiatric symptoms",
    "medical emergencies",
    "situations beyond the intended scope of AVAIA",
  ],
} as const;

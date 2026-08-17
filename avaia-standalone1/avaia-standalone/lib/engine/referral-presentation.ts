import "server-only";
import {
  formatVirtueClassifications,
  formatSecondaryLossClassifications,
  formatReferralFields,
} from "@/lib/engine/referral-provenance";
import type { Stage } from "@/lib/engine/prompts";

// Renders a CAT-generated referral into the plain-language, epistemically-
// ordered form InnerCompass receives, instead of the raw JSON dump every
// other stage still uses. Root cause: InnerCompass kept converging on
// referral-flagged themes (e.g. a "steward/program" identity thread) instead
// of following what was alive in the live conversation, and its own
// generated language started echoing internal schema field names (e.g.
// "That's integration" after seeing a field called integrationPoints) --
// both traced to the raw JSON dump exposing schema vocabulary and treating
// CAT's own interpretive synthesis as equally authoritative as the Host's
// verbatim words. This function fixes the data InnerCompass receives, not
// another prompt instruction competing against that data.
//
// Does not touch referral storage, generation, schemas, the Workbook, or
// sharing -- purely a rendering step between "read from the database" and
// "inject into the system prompt," used only at InnerCompass's two
// referral-receiving call sites (generateInnerCompassOpening in
// api/referral/route.ts, and the ongoing-conversation injection in
// api/conversation/route.ts for stage === "innercompass"). CAT's own
// IAP-referral injection is untouched and still uses raw JSON.

type CatReferralContent = Record<string, unknown>;

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim());
}

/** Renders a labeled field as a paragraph (single string) or bullet list
 *  (array), omitting it entirely if there's nothing to show. */
function field(label: string, value: string | string[] | null): string | null {
  if (value === null) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return `${label}:\n${value.map((v) => `- ${v}`).join("\n")}`;
  }
  return `${label}: ${value}`;
}

export function formatCatReferralForInnerCompass(content: CatReferralContent): string {
  const sections: string[] = [];

  // 1. Room Identity
  const title = str(content.title);
  if (title) sections.push(`ROOM IDENTITY: "${title}"`);

  // 2. Host's own words -- anchorStatements + reflectionsThatEmerged,
  // exact-string deduplicated. A near-duplicate with extra trailing text
  // is not caught by this and will appear twice; that's an accepted limit
  // of exact matching rather than attempting fuzzy dedup.
  const anchors = arr(content.anchorStatements);
  const seenExact = new Set(anchors);
  const reflections = arr(content.reflectionsThatEmerged).filter((r) => !seenExact.has(r));
  const hostWords = [...anchors, ...reflections];
  if (hostWords.length > 0) {
    sections.push(
      [
        "IN THE HOST'S OWN WORDS (language preserved from the prior conversation)",
        ...hostWords.map((q) => `"${q}"`),
      ].join("\n")
    );
  }

  // 3. CAT's prior synthesis
  const synthesis = [
    field("Overview", str(content.hostOverview)),
    field("Loss CAT identified as central", str(content.primaryLoss)),
    field(
      "Other losses CAT noticed",
      formatSecondaryLossClassifications(content.significantSecondaryLosses)
    ),
    field("Patterns CAT noticed", arr(content.identityThreads)),
    field("Tensions CAT noticed", arr(content.activeTensions)),
    field("Understandings and recognitions CAT carried forward", [
      ...arr(content.majorUnderstandings),
      ...arr(content.keyRecognitions),
    ]),
    field("Virtues CAT connected to this", formatVirtueClassifications(content.relevantVirtues)),
    field("Places CAT saw things connecting", arr(content.integrationPoints)),
    field("Council perspectives CAT noted", arr(content.councilPerspectives)),
  ].filter((s): s is string => s !== null);

  if (synthesis.length > 0) {
    sections.push(
      [
        "WHAT CAT NOTICED (grounded in the prior CAT conversation and useful as",
        "prior understanding, but still open to refinement in InnerCompass. Treat",
        "it as context to test against what becomes alive here, not as settled",
        "authority over the Host's meaning.)",
        "",
        ...synthesis,
      ].join("\n")
    );
  }

  // 4. Still-open material -- exact-deduplicated across both fields
  const openSeen = new Set<string>();
  const openMaterial = [
    ...arr(content.unresolvedQuestions),
    ...arr(content.questionsWorthCarrying),
  ].filter((q) => (openSeen.has(q) ? false : (openSeen.add(q), true)));
  if (openMaterial.length > 0) {
    sections.push(
      [
        "STILL OPEN (CAT left these unresolved -- possibilities available to this",
        "conversation, not questions InnerCompass is required to ask)",
        ...openMaterial.map((q) => `- ${q}`),
      ].join("\n")
    );
  }

  // 5. Why CAT referred the Host here
  const purpose = str(content.nextConversationPurpose);
  if (purpose) {
    sections.push(
      [
        "WHY CAT REFERRED THE HOST HERE",
        "This explains the handoff. It does not determine the direction of this conversation.",
        purpose,
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}

// Replaces the generic "established context -- do not ask the Host to
// repeat it; build from it" wrapper for InnerCompass specifically, at both
// call sites. CAT's own referral wrapper (in api/conversation/route.ts, for
// stage === "cat") is untouched and keeps its original wording.
export const INNERCOMPASS_REFERRAL_WRAPPER =
  "CARRIED-FORWARD AVAIA CONTEXT — do not ask the Host to repeat what is " +
  "already here. Use this as memory and prior understanding while allowing " +
  "the current conversation to refine, redirect, or supersede it.";

const REFERRAL_OPENING: Record<Stage, string> = {
  iap: "I have completed the Individual Awareness Profile. Please use the following referral information as the starting point for Conversations Across Time.",
  cat: "I have completed Conversations Across Time. Please use the following referral information as the starting point for InnerCompass.",
  innercompass: "I have completed InnerCompass. Please use the following referral information as the starting point for continuity.",
};

// Deterministic, render-not-generate presentation of a just-completed
// stage's authoritative referral -- the single source for what the Host
// reads in chat at the moment of completion, persisted to the transcript
// exactly as written here. Replaces CAT_REFERRAL_PRESENTATION and
// INNERCOMPASS_REFERRAL_PRESENTATION (removed in lib/engine/prompts.ts),
// which asked the model to independently improvise this prose in a second,
// ungoverned generation -- the root cause traced in the completion-
// architecture investigation (invalid virtue pairings and an unadopted
// Guide framing both reached the Host through that path, never through
// the sanitized, calibration-disciplined structured referral). Built
// entirely from formatReferralFields, the same formatter Workbook and
// Shared-with-me already use, so this presentation, the Workbook, and the
// next stage's own reception of the referral are all views of the one
// stored record -- never a second LLM call.
export function formatReferralForHostPresentation(
  stage: Stage,
  content: Record<string, unknown> | null | undefined
): string {
  const items = formatReferralFields(stage, content);
  const sections = items.map((item) =>
    Array.isArray(item.value)
      ? [`${item.label}:`, ...item.value.map((v) => `- ${v}`)].join("\n")
      : `${item.label}: ${item.value}`
  );
  return [REFERRAL_OPENING[stage], "", ...sections].join("\n\n");
}

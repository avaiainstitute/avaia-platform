/**
 * The AVAIA Conversation Integrity & Boundary Oversight Agent -- pure,
 * deterministic resolver. Audited against the current repository before
 * writing anything here (see the final report for the full audit): a real
 * crisis prefilter (lib/engine/anthropic.ts's detectCrisis, feeding the
 * existing crisis_events table) already exists and is NOT duplicated by
 * anything in this file. No prompt/model-version table exists anywhere
 * (lib/engine/prompts.ts's AVAIA_MODEL is a single string constant).
 *
 * GOVERNING STATEMENT (binding on every function here): this agent
 * protects the boundaries of the conversation without interpreting,
 * diagnosing, or taking ownership of the person inside it. Nothing
 * exported from this file can produce "Host is unstable," "Host is
 * resistant," "Guide is narcissistic," or any other character/
 * psychological judgment -- every function below returns, at most, a
 * possible-flag category naming an AVAIA rule a turn may be inconsistent
 * with, never a conclusion about a person's character or condition. A
 * flag is a possible flag, never an automatic finding; human_disposition
 * is the only thing that ever turns a flag into a finding, and this file
 * never sets it.
 *
 * HONESTY-SCOPED AUTOMATED DETECTION: most of the 15 flag categories
 * require genuine semantic/clinical judgment this file cannot honestly
 * automate without inventing policy or risking exactly the psychological
 * overreach this agent exists to prevent. This file implements real,
 * conservative, recall-favoring keyword/correlation detection -- modeled
 * directly on detectCrisis's own "favor recall, a false positive just
 * shows a calm note" precedent -- for only: SAFETY_PROTOCOL (crisis-event
 * correlation), and keyword prefilters for DIAGNOSTIC_OVERREACH,
 * PRESCRIPTION, and SCOPE_OVERREACH, scanning ONLY Guide/AI-role replies,
 * never Host content (so this file can never be used to profile what a
 * Host says). The full category/severity/disposition vocabulary is
 * supported end-to-end regardless, so a human reviewer can always record
 * any of the 15 -- see the final report's "intentionally deferred"
 * section for the categories this file does not attempt to auto-detect.
 */

export const FLAG_CATEGORIES = [
  "DIAGNOSTIC_OVERREACH",
  "PRESCRIPTION",
  "SCOPE_OVERREACH",
  "CAPACITY_OR_CONSENT",
  "FORCED_DISCLOSURE",
  "HOST_OWNERSHIP",
  "RECOGNITION_OVERREACH",
  "EMOTIONAL_INTENSITY_MISUSE",
  "PRIVACY_SCOPE",
  "YOUTH_SAFEGUARD",
  "SAFETY_PROTOCOL",
  "IMPROPER_CARRY_FORWARD",
  "SYSTEM_PROMPT_BEHAVIOR",
  "POLICY_REQUIRED",
  "LEGAL_REVIEW_REQUIRED",
] as const;
export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

export const SEVERITIES = ["INFORMATIONAL", "REVIEW", "HIGH_PRIORITY", "POLICY_REQUIRED", "LEGAL_REVIEW_REQUIRED"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const HUMAN_DISPOSITIONS = [
  "NO_VIOLATION",
  "COACHING_OR_CORRECTION",
  "SYSTEM_PROMPT_FIX",
  "GUIDE_REVIEW_REQUIRED",
  "ACCESS_OR_PRIVACY_ACTION",
  "SAFETY_ESCALATION",
  "POLICY_REQUIRED",
  "LEGAL_REVIEW_REQUIRED",
] as const;
export type HumanDisposition = (typeof HUMAN_DISPOSITIONS)[number];

export type InvolvedRole = "host" | "guide";
export type Stage = "iap" | "cat" | "innercompass";

/** Default severity for an automatically-detected flag. A human reviewer
 *  may always raise or lower this on disposition -- this is a starting
 *  point, not a verdict. Ordinary conversation errors default to REVIEW,
 *  never HIGH_PRIORITY, per item 15. */
export const DEFAULT_SEVERITY: Record<FlagCategory, Severity> = {
  DIAGNOSTIC_OVERREACH: "REVIEW",
  PRESCRIPTION: "REVIEW",
  SCOPE_OVERREACH: "REVIEW",
  CAPACITY_OR_CONSENT: "REVIEW",
  FORCED_DISCLOSURE: "HIGH_PRIORITY",
  HOST_OWNERSHIP: "REVIEW",
  RECOGNITION_OVERREACH: "REVIEW",
  EMOTIONAL_INTENSITY_MISUSE: "REVIEW",
  PRIVACY_SCOPE: "HIGH_PRIORITY",
  YOUTH_SAFEGUARD: "HIGH_PRIORITY",
  SAFETY_PROTOCOL: "HIGH_PRIORITY",
  IMPROPER_CARRY_FORWARD: "REVIEW",
  SYSTEM_PROMPT_BEHAVIOR: "REVIEW",
  POLICY_REQUIRED: "POLICY_REQUIRED",
  LEGAL_REVIEW_REQUIRED: "LEGAL_REVIEW_REQUIRED",
};

export type DetectedFlag = {
  category: FlagCategory;
  severity: Severity;
  avaiaRuleImplicated: string;
  detectionBasis: string;
};

// ---------------------------------------------------------------------------
// Keyword prefilters -- Guide/AI-role replies only. Conservative and
// recall-favoring by design: a false positive here just creates a REVIEW
// item a human clears in seconds; a false negative leaves a real boundary
// issue unflagged. Never run against Host content.
// ---------------------------------------------------------------------------

const DIAGNOSTIC_LANGUAGE_PATTERNS: RegExp[] = [
  /\byou (have|'ve got|are showing signs of)\s+(depression|anxiety disorder|ptsd|bipolar|a (personality|mood) disorder)\b/i,
  /\bthat('s| is) (textbook|a classic case of|clinically)\b/i,
  /\byou('re| are) (clinically|medically) /i,
  /\bi('m| am) diagnosing you with\b/i,
];

const PRESCRIPTIVE_LANGUAGE_PATTERNS: RegExp[] = [
  /\byou (should|need to|must) (take|start taking|stop taking|increase|decrease)\s+\w+\s*(mg|milligrams|medication|dosage)\b/i,
  /\bi (prescribe|am prescribing)\b/i,
  /\byour (treatment plan|dosage|medication) should be\b/i,
];

const SCOPE_OVERREACH_PATTERNS: RegExp[] = [
  /\byou (should|need to) sue\b/i,
  /\blegally[, ]+you (are entitled|must|have to)\b/i,
  /\bas your (lawyer|attorney)\b/i,
  /\byou should (invest in|sell|buy)\s+\w+\s*(stock|shares|crypto)\b/i,
  /\bas your financial advisor\b/i,
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    if (p.test(text)) return p.source;
  }
  return null;
}

/** Scans a single Guide/AI-role reply for the subset of boundary issues
 *  that are honestly expressible as keyword prefilters. Returns zero or
 *  more possible flags -- never a conclusion, always REVIEW-by-default. */
export function scanGuideReplyForBoundaryFlags(replyText: string): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  const diag = firstMatch(replyText, DIAGNOSTIC_LANGUAGE_PATTERNS);
  if (diag) {
    flags.push({
      category: "DIAGNOSTIC_OVERREACH",
      severity: DEFAULT_SEVERITY.DIAGNOSTIC_OVERREACH,
      avaiaRuleImplicated: "AVAIA Guides and AI conversations do not diagnose or label a Host's condition.",
      detectionBasis: `keyword pattern: diagnostic-language prefilter (${diag})`,
    });
  }
  const prescr = firstMatch(replyText, PRESCRIPTIVE_LANGUAGE_PATTERNS);
  if (prescr) {
    flags.push({
      category: "PRESCRIPTION",
      severity: DEFAULT_SEVERITY.PRESCRIPTION,
      avaiaRuleImplicated: "AVAIA Guides and AI conversations do not prescribe medication or treatment.",
      detectionBasis: `keyword pattern: prescriptive-language prefilter (${prescr})`,
    });
  }
  const scope = firstMatch(replyText, SCOPE_OVERREACH_PATTERNS);
  if (scope) {
    flags.push({
      category: "SCOPE_OVERREACH",
      severity: DEFAULT_SEVERITY.SCOPE_OVERREACH,
      avaiaRuleImplicated: "AVAIA Guides and AI conversations do not give legal or financial advice inside the Guide/AVAIA role.",
      detectionBasis: `keyword pattern: legal/financial-advice prefilter (${scope})`,
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// SAFETY_PROTOCOL -- correlates an existing crisis_events row with whether
// the very next Guide/AI reply actually carried crisis-protocol language.
// This never re-decides whether a crisis existed (detectCrisis already
// did); it only verifies the established pathway was followed.
// ---------------------------------------------------------------------------

const CRISIS_PROTOCOL_LANGUAGE_PATTERNS: RegExp[] = [
  /\b988\b/,
  /\b911\b/,
  /\b741741\b/,
  /crisis (line|hotline|resource|support)/i,
  /\b(suicide|crisis) (and|&) crisis lifeline\b/i,
  /professional (support|help)/i,
  /reach out to a (professional|counselor|therapist)/i,
];

export function guideReplyFollowedSafetyProtocol(replyText: string): boolean {
  return CRISIS_PROTOCOL_LANGUAGE_PATTERNS.some((p) => p.test(replyText));
}

/** Given that a crisis_events row fired on the Host's turn, evaluate the
 *  very next Guide/AI reply. Returns a flag only when the pathway was NOT
 *  followed -- silence (no flag) is the expected, healthy outcome. */
export function evaluateSafetyProtocolFollowThrough(nextGuideReplyText: string): DetectedFlag | null {
  if (guideReplyFollowedSafetyProtocol(nextGuideReplyText)) return null;
  return {
    category: "SAFETY_PROTOCOL",
    severity: DEFAULT_SEVERITY.SAFETY_PROTOCOL,
    avaiaRuleImplicated:
      "When the existing crisis prefilter fires, the established AVAIA safety pathway (crisis-protocol language, referral to 988/911/741741 or professional support) must be followed in the very next reply.",
    detectionBasis: "crisis_events correlation: next Guide/AI reply contained no crisis-protocol language",
  };
}

// ---------------------------------------------------------------------------
// Flag records, admin/guide-facing views, and pattern detection
// ---------------------------------------------------------------------------

export type ReviewStatus = "open" | "in_review" | "resolved";

export type IntegrityFlag = {
  id: string;
  conversationId: string | null;
  hostId: string | null;
  messageId: string | null;
  stage: Stage | null;
  program: string | null;
  involvedRole: InvolvedRole | null;
  flagCategory: FlagCategory;
  severity: Severity;
  avaiaRuleImplicated: string;
  detectionBasis: string;
  modelSnapshot: string | null;
  reviewStatus: ReviewStatus;
  humanDisposition: HumanDisposition | null;
  correctiveAction: string | null;
  createdAt: string;
};

/** A Guide-facing surface may see that review was requested and any
 *  coaching/correction outcome -- never internal reviewer notes, the
 *  detection basis, or another role's conversation content (item 24). */
export type GuideFacingIntegrityView = {
  id: string;
  flagCategory: FlagCategory;
  reviewStatus: ReviewStatus;
  coachingNote: string | null;
  createdAt: string;
};

export function toGuideFacingIntegrityView(flag: IntegrityFlag): GuideFacingIntegrityView {
  const coachingShown =
    flag.humanDisposition === "COACHING_OR_CORRECTION" || flag.humanDisposition === "GUIDE_REVIEW_REQUIRED";
  return {
    id: flag.id,
    flagCategory: flag.flagCategory,
    reviewStatus: flag.reviewStatus,
    coachingNote: coachingShown ? flag.correctiveAction : null,
    createdAt: flag.createdAt,
  };
}

export type IntegrityPattern = {
  key: string;
  dimension: "stage" | "program" | "model_snapshot";
  value: string;
  category: FlagCategory;
  count: number;
  flagIds: string[];
};

/** Aggregates recurring AI/system or Guide-pattern signals (item 21/22),
 *  grouped by category + stage/program/model snapshot -- computed live
 *  over the flag rows, never persisted into a separate pattern table. */
export function detectRecurringIntegrityPatterns(flags: IntegrityFlag[], minCount = 3): IntegrityPattern[] {
  const groups = new Map<string, IntegrityPattern>();
  const addTo = (dimension: IntegrityPattern["dimension"], value: string | null, flag: IntegrityFlag) => {
    if (!value) return;
    const key = `${dimension}::${value}::${flag.flagCategory}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.flagIds.push(flag.id);
    } else {
      groups.set(key, { key, dimension, value, category: flag.flagCategory, count: 1, flagIds: [flag.id] });
    }
  };
  for (const flag of flags) {
    if (flag.reviewStatus === "resolved" && flag.humanDisposition === "NO_VIOLATION") continue;
    addTo("stage", flag.stage, flag);
    addTo("program", flag.program, flag);
    addTo("model_snapshot", flag.modelSnapshot, flag);
  }
  return Array.from(groups.values())
    .filter((p) => p.count >= minCount)
    .sort((a, b) => b.count - a.count);
}

export type ConversationIntegritySummary = {
  open: number;
  inReview: number;
  highPriority: IntegrityFlag[];
  policyRequired: IntegrityFlag[];
  legalReviewRequired: IntegrityFlag[];
  byCategory: Record<FlagCategory, number>;
  recurringPatterns: IntegrityPattern[];
  healthyNoViolation: number;
};

export function summarizeConversationIntegrity(flags: IntegrityFlag[]): ConversationIntegritySummary {
  const byCategory = Object.fromEntries(FLAG_CATEGORIES.map((c) => [c, 0])) as Record<FlagCategory, number>;
  let open = 0;
  let inReview = 0;
  let healthyNoViolation = 0;
  const highPriority: IntegrityFlag[] = [];
  const policyRequired: IntegrityFlag[] = [];
  const legalReviewRequired: IntegrityFlag[] = [];

  for (const flag of flags) {
    byCategory[flag.flagCategory] += 1;
    if (flag.reviewStatus === "open") open += 1;
    if (flag.reviewStatus === "in_review") inReview += 1;
    if (flag.humanDisposition === "NO_VIOLATION") healthyNoViolation += 1;
    if (flag.reviewStatus !== "resolved") {
      if (flag.severity === "HIGH_PRIORITY") highPriority.push(flag);
      if (flag.severity === "POLICY_REQUIRED") policyRequired.push(flag);
      if (flag.severity === "LEGAL_REVIEW_REQUIRED") legalReviewRequired.push(flag);
    }
  }

  return {
    open,
    inReview,
    highPriority,
    policyRequired,
    legalReviewRequired,
    byCategory,
    recurringPatterns: detectRecurringIntegrityPatterns(flags),
    healthyNoViolation,
  };
}

/** What belongs on the Founder Digest (item 26) -- deliberately narrow:
 *  routine NO_VIOLATION reviews and informational flags never appear. */
export function founderDigestWorthyIntegrityItems(summary: ConversationIntegritySummary): string[] {
  const lines: string[] = [];
  if (summary.highPriority.length > 0) lines.push(`${summary.highPriority.length} high-priority integrity flag(s) open.`);
  if (summary.policyRequired.length > 0) lines.push(`${summary.policyRequired.length} integrity item(s) require an AVAIA policy decision.`);
  if (summary.legalReviewRequired.length > 0) lines.push(`${summary.legalReviewRequired.length} integrity item(s) require legal review.`);
  for (const p of summary.recurringPatterns.slice(0, 5)) {
    lines.push(`Recurring: ${p.count}x ${p.category} on ${p.dimension}=${p.value}.`);
  }
  return lines;
}

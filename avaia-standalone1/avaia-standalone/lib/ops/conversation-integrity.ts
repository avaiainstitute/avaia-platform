import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import {
  detectRecurringIntegrityPatterns,
  evaluateSafetyProtocolFollowThrough,
  scanGuideReplyForBoundaryFlags,
  type DetectedFlag,
  type FlagCategory,
  type HumanDisposition,
  type IntegrityFlag,
  type InvolvedRole,
  type ReviewStatus,
  type Severity,
  type Stage,
} from "@/lib/conversation-integrity";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// CONVERSATION INTEGRITY & BOUNDARY OVERSIGHT, as an operational capability.
//
// WHAT RUNS: every time an AVAIA conversation produces a reply (the Journey, What
// Still Needs to Be Said, Unsung Heroes, Shared Rooms, the Certification
// Companion, and the opening of each conversation), recordIntegrityForReply scans
// ONLY that reply, the AI speaking, for the few boundary problems that keywords
// can honestly detect (diagnosing, prescribing, legal or financial advice), and,
// when a crisis was just flagged, checks that the reply followed the established
// crisis pathway. It never scans a Host's words, and it never decides anything
// about a person.
//
// WHAT IS STORED: a category, the AVAIA rule it may be inconsistent with, how it
// was detected, and the surface and time. NEVER the message text, never a quote.
//
// WHAT NEEDS A PERSON: a flag is only ever a POSSIBLE flag; only a person's
// recorded disposition (app/admin/conversation-integrity) turns it into a
// finding. High-priority, policy and legal flags, and recurring patterns, are
// decisions for Dorian in What Needs Dorian; ordinary REVIEW flags are listed for
// visibility so a false positive never becomes a task.

type FlagRow = {
  id: string;
  conversation_id: string | null;
  host_id: string | null;
  message_id: string | null;
  stage: Stage | null;
  program: string | null;
  involved_role: InvolvedRole | null;
  flag_category: FlagCategory;
  severity: Severity;
  avaia_rule_implicated: string;
  detection_basis: string;
  model_snapshot: string | null;
  review_status: ReviewStatus;
  human_disposition: HumanDisposition | null;
  corrective_action: string | null;
  created_at: string;
};

const FLAG_COLUMNS =
  "id, conversation_id, host_id, message_id, stage, program, involved_role, flag_category, severity, avaia_rule_implicated, detection_basis, model_snapshot, review_status, human_disposition, corrective_action, created_at";

function toFlag(r: FlagRow): IntegrityFlag {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    hostId: r.host_id,
    messageId: r.message_id,
    stage: r.stage,
    program: r.program,
    involvedRole: r.involved_role,
    flagCategory: r.flag_category,
    severity: r.severity,
    avaiaRuleImplicated: r.avaia_rule_implicated,
    detectionBasis: r.detection_basis,
    modelSnapshot: r.model_snapshot,
    reviewStatus: r.review_status,
    humanDisposition: r.human_disposition,
    correctiveAction: r.corrective_action,
    createdAt: r.created_at,
  };
}

/** Pure: which flags a reply produces. Separate from the write so tests can run it. */
export function flagsForReply(replyText: string, crisisJustFired: boolean): DetectedFlag[] {
  const detected = scanGuideReplyForBoundaryFlags(replyText);
  if (crisisJustFired) {
    const safety = evaluateSafetyProtocolFollowThrough(replyText);
    if (safety) detected.push(safety);
  }
  return detected;
}

/** Called right after an AI reply is produced. Never throws and never delays or
 *  alters the reply: a failure here is only logged. `surface` names where the
 *  reply was produced (stored in `program` when the conversation has no program of
 *  its own); `conversationId` is passed only for surfaces whose conversation is a
 *  row in the `conversations` table. */
export async function recordIntegrityForReply(args: {
  hostId: string;
  surface: string;
  replyText: string;
  crisisJustFired?: boolean;
  conversationId?: string | null;
  stage?: Stage | null;
  program?: string | null;
}): Promise<void> {
  try {
    const detected = flagsForReply(args.replyText, !!args.crisisJustFired);
    if (detected.length === 0) return;
    const admin = createAdminClient();
    const { error } = await admin.from("conversation_integrity_flags").insert(
      detected.map((flag) => ({
        conversation_id: args.conversationId ?? null,
        host_id: args.hostId,
        message_id: null,
        stage: args.stage ?? null,
        program: args.program ?? args.surface,
        involved_role: "guide" as InvolvedRole,
        flag_category: flag.category,
        severity: flag.severity,
        avaia_rule_implicated: flag.avaiaRuleImplicated,
        detection_basis: flag.detectionBasis,
        model_snapshot: AVAIA_MODEL,
      }))
    );
    if (error) console.error("[conversation-integrity] flag was not recorded", error.message);
  } catch (err) {
    console.error("[conversation-integrity] scan failed", err instanceof Error ? err.message : err);
  }
}

export async function getAllIntegrityFlags(): Promise<IntegrityFlag[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("conversation_integrity_flags").select(FLAG_COLUMNS).order("created_at", { ascending: false }).limit(1000);
  return ((data ?? []) as FlagRow[]).map(toFlag);
}

/** Admin-only: the ONE place human_disposition is ever written. Only a person's
 *  recorded choice turns a possible flag into a finding. */
export async function recordIntegrityDisposition(args: {
  flagId: string;
  reviewerId: string;
  reviewStatus: ReviewStatus;
  humanDisposition: HumanDisposition | null;
  correctiveAction?: string | null;
}): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("conversation_integrity_flags")
    .update({
      review_status: args.reviewStatus,
      human_disposition: args.humanDisposition,
      corrective_action: args.correctiveAction?.trim() || null,
      reviewed_by: args.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.flagId);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// The capability
// ---------------------------------------------------------------------------

const unresolved = (f: IntegrityFlag) => f.reviewStatus !== "resolved";

/** Pure: turns flags into the capability result. */
export function classifyConversationIntegrity(flags: IntegrityFlag[]): CapabilityResult {
  const decisions: NeedsItem[] = [];
  const watching: NeedsItem[] = [];
  const href = "/admin/conversation-integrity";

  for (const f of flags.filter(unresolved)) {
    if (f.severity === "HIGH_PRIORITY" || f.severity === "POLICY_REQUIRED" || f.severity === "LEGAL_REVIEW_REQUIRED") {
      const kind = f.severity === "HIGH_PRIORITY" ? "A high-priority" : f.severity === "POLICY_REQUIRED" ? "An AVAIA-policy" : "A legal-review";
      decisions.push({
        key: `integrity:flag:${f.id}`,
        text: `${kind} conversation-integrity flag is waiting for your review: ${f.flagCategory.replace(/_/g, " ").toLowerCase()} (${f.program ?? "conversation"}, ${new Date(f.createdAt).toLocaleDateString()}).`,
        href,
        detail: `Rule it may be inconsistent with: ${f.avaiaRuleImplicated} Detected by: ${f.detectionBasis}. This is a possible flag, not a finding; no message text is stored.`,
      });
    }
  }

  const ordinary = flags.filter((f) => unresolved(f) && f.severity !== "HIGH_PRIORITY" && f.severity !== "POLICY_REQUIRED" && f.severity !== "LEGAL_REVIEW_REQUIRED");
  if (ordinary.length > 0) {
    watching.push({
      key: "integrity:ordinary",
      text: `${ordinary.length} ordinary conversation-integrity flag(s) are waiting in the review queue (keyword checks on the AI's own replies; a false positive clears in seconds). Visibility only.`,
      href,
    });
  }

  // Patterns are computed over unresolved flags only, so recording a disposition clears them.
  for (const p of detectRecurringIntegrityPatterns(flags.filter(unresolved))) {
    decisions.push({
      key: `integrity:pattern:${p.key}`,
      text: `Recurring conversation-integrity pattern: ${p.count} ${p.category.replace(/_/g, " ").toLowerCase()} flags awaiting review on ${p.dimension.replace(/_/g, " ")} "${p.value}". It may point to a system-prompt fix.`,
      href,
    });
  }

  return { key: "conversation_integrity", label: "Conversation Integrity & Boundary Oversight", evaluated: flags.length, decisions, watching };
}

export async function evaluateConversationIntegrity(): Promise<CapabilityResult> {
  return classifyConversationIntegrity(await getAllIntegrityFlags());
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type IntegrityFlag,
  type FlagCategory,
  type Severity,
  type ReviewStatus,
  type HumanDisposition,
  type InvolvedRole,
  type Stage,
  type DetectedFlag,
  scanGuideReplyForBoundaryFlags,
  evaluateSafetyProtocolFollowThrough,
  summarizeConversationIntegrity,
  founderDigestWorthyIntegrityItems,
  type ConversationIntegritySummary,
} from "@/lib/conversation-integrity";
import { AVAIA_MODEL } from "@/lib/engine/prompts";

// Conversation Integrity & Boundary Oversight Agent -- admin-client I/O
// layer over the pure resolver in lib/conversation-integrity.ts. Mirrors
// lib/ops/certification-operations.ts's own shape. Never sets
// human_disposition itself -- that column is only ever written by a human
// reviewer through the admin surface (recordIntegrityDisposition).

const COOLDOWN_DAYS = Number(process.env.CONVERSATION_INTEGRITY_COOLDOWN_DAYS ?? 3);

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

function toFlag(row: FlagRow): IntegrityFlag {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    hostId: row.host_id,
    messageId: row.message_id,
    stage: row.stage,
    program: row.program,
    involvedRole: row.involved_role,
    flagCategory: row.flag_category,
    severity: row.severity,
    avaiaRuleImplicated: row.avaia_rule_implicated,
    detectionBasis: row.detection_basis,
    modelSnapshot: row.model_snapshot,
    reviewStatus: row.review_status,
    humanDisposition: row.human_disposition,
    correctiveAction: row.corrective_action,
    createdAt: row.created_at,
  };
}

/** Called from app/api/conversation/route.ts right after a Guide/AI reply
 *  is persisted. Scans only the reply text just generated (never Host
 *  content), and separately correlates an existing crisis_events firing
 *  against this same reply for SAFETY_PROTOCOL. Writes with the caller's
 *  own session client (insert-only-self RLS), exactly mirroring how
 *  crisis_events itself is already written in that route -- no admin
 *  client in the hot streaming path. */
export async function recordRealtimeIntegrityFlags(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  args: {
    hostId: string;
    conversationId: string;
    messageId?: string | null;
    stage: Stage;
    program: string | null;
    replyText: string;
    crisisJustFired: boolean;
  }
): Promise<void> {
  const detected: DetectedFlag[] = scanGuideReplyForBoundaryFlags(args.replyText);

  if (args.crisisJustFired) {
    const safety = evaluateSafetyProtocolFollowThrough(args.replyText);
    if (safety) detected.push(safety);
  }

  if (detected.length === 0) return;

  await supabase.from("conversation_integrity_flags").insert(
    detected.map((flag) => ({
      conversation_id: args.conversationId,
      host_id: args.hostId,
      message_id: args.messageId ?? null,
      stage: args.stage,
      program: args.program,
      involved_role: "guide" as InvolvedRole,
      flag_category: flag.category,
      severity: flag.severity,
      avaia_rule_implicated: flag.avaiaRuleImplicated,
      detection_basis: flag.detectionBasis,
      model_snapshot: AVAIA_MODEL,
    }))
  );
}

export async function getAllIntegrityFlags(): Promise<IntegrityFlag[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("conversation_integrity_flags")
    .select(
      "id, conversation_id, host_id, message_id, stage, program, involved_role, flag_category, severity, avaia_rule_implicated, detection_basis, model_snapshot, review_status, human_disposition, corrective_action, created_at"
    )
    .order("created_at", { ascending: false });
  return ((data ?? []) as FlagRow[]).map(toFlag);
}

export async function getConversationIntegritySummary(): Promise<{
  summary: ConversationIntegritySummary;
  flags: IntegrityFlag[];
}> {
  const flags = await getAllIntegrityFlags();
  return { summary: summarizeConversationIntegrity(flags), flags };
}

/** Admin/reviewer-only disposition write -- the ONE place human_disposition
 *  and corrective_action are ever set. Never called from the realtime
 *  conversation path. */
export async function recordIntegrityDisposition(args: {
  flagId: string;
  reviewedBy: string;
  humanDisposition: HumanDisposition;
  correctiveAction?: string | null;
  reviewStatus?: ReviewStatus;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("conversation_integrity_flags")
    .update({
      human_disposition: args.humanDisposition,
      corrective_action: args.correctiveAction ?? null,
      review_status: args.reviewStatus ?? "resolved",
      reviewed_by: args.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.flagId);
}

export type ConversationIntegrityNotification = {
  flagId: string;
  hostId: string | null;
  flagCategory: FlagCategory;
  severity: Severity;
  detail: string;
};

/** Daily cron body -- identical cooldown/idempotency shape to
 *  recordToolkitStewardshipReminders. Only ever notifies admin/ops, never
 *  the Host or the Guide whose reply triggered the flag. Only open/
 *  in_review flags generate a reminder -- resolved flags never do. */
export async function recordConversationIntegrityReminders(
  sendFn: (n: ConversationIntegrityNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const flags = await getAllIntegrityFlags();

  let sent = 0;
  let skippedCooldown = 0;

  const needsAttention = flags.filter((f) => f.reviewStatus !== "resolved");

  for (const flag of needsAttention) {
    const { data: lastRow } = await admin
      .from("conversation_integrity_reminders")
      .select("sent_at")
      .eq("flag_id", flag.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRow) {
      const daysSince = (Date.now() - new Date(lastRow.sent_at).getTime()) / 86_400_000;
      if (daysSince < COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    await sendFn({
      flagId: flag.id,
      hostId: flag.hostId,
      flagCategory: flag.flagCategory,
      severity: flag.severity,
      detail: flag.avaiaRuleImplicated,
    });
    await admin.from("conversation_integrity_reminders").insert({ flag_id: flag.id, reminder_type: "reviewer_reminder" });
    sent += 1;
  }

  return { sent, skippedCooldown };
}

export { founderDigestWorthyIntegrityItems };

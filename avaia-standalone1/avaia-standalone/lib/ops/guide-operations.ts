import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agent 7 (Guide Operations), Automation Blueprint Phase 3. This module
// never evaluates a candidate's competency, invents a certification
// requirement, or changes guide_candidates.status /
// guide_certifications.standing itself -- per the build instruction, "do
// not invent certification requirements." All it does is notice two
// specific, purely mechanical waiting states that already exist in the
// schema's own vocabulary (see supabase/migrations/0022, 0024, 0062) and
// surface them so Dorian can act. Every actual institutional judgment
// (admitting a candidate, recording a decision, granting certification)
// stays a deliberate, separate, human action through the existing tables.

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

// Candidacy statuses that are still open (mirrors the partial unique index
// in 0022_guide_certification_records.sql: guide_candidates_one_open_per_host
// excludes only 'withdrawn' and 'not_certified').
const OPEN_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required", "paused", "hold"];

export type GuideOperationsWaitingItem =
  | { type: "paid_awaiting_decision"; hostId: string; paidAt: string; sinceDays: number }
  | { type: "candidacy_stalled"; candidateId: string; hostId: string; status: string; sinceDays: number };

/** One pass over guide_certification_payments, guide_candidates, and
 *  guide_candidate_history (recorded_at/entry_type only -- never `body`,
 *  which can hold free-text evaluator notes) to surface exactly two
 *  waiting states, both purely about elapsed time against an existing
 *  institutional record, never about what was said in that record. */
export async function getGuideOperationsSnapshot(): Promise<{
  waitingItems: GuideOperationsWaitingItem[];
}> {
  const admin = createAdminClient();
  const now = Date.now();
  const waitingItems: GuideOperationsWaitingItem[] = [];

  // --- paid_awaiting_decision ------------------------------------------
  // A completed $4,500 payment (guide_certification_payments) with no
  // guide_certification_decisions row yet recorded for that same host.
  // Deliberately does not require an open guide_candidates row -- a
  // payment never creates or depends on one (see 0062's own comment).
  const { data: paymentRows } = await admin
    .from("guide_certification_payments")
    .select("host_id, paid_at")
    .order("paid_at", { ascending: true });
  const payments = (paymentRows ?? []) as { host_id: string; paid_at: string }[];

  const { data: decisionRows } = await admin
    .from("guide_certification_decisions")
    .select("host_id");
  const decisions = (decisionRows ?? []) as { host_id: string }[];

  const decidedHostIds = new Set(decisions.map((d) => d.host_id));

  for (const payment of payments) {
    if (decidedHostIds.has(payment.host_id)) continue;
    const ageDays = (now - new Date(payment.paid_at).getTime()) / 86_400_000;
    if (ageDays >= STALL_DAYS) {
      waitingItems.push({
        type: "paid_awaiting_decision",
        hostId: payment.host_id,
        paidAt: payment.paid_at,
        sinceDays: Math.floor(ageDays),
      });
    }
  }

  // --- candidacy_stalled -------------------------------------------------
  // An open candidacy with no history entry recorded in the last
  // STALL_DAYS (falling back to admitted_at when no history exists yet).
  const { data: candidateRows } = await admin
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at")
    .in("status", OPEN_CANDIDACY_STATUSES);
  const candidates = (candidateRows ?? []) as { id: string; host_id: string; status: string; admitted_at: string }[];

  const { data: historyRowsRaw } = await admin
    .from("guide_candidate_history")
    .select("candidate_id, recorded_at")
    .order("recorded_at", { ascending: false });
  const historyRows = (historyRowsRaw ?? []) as { candidate_id: string; recorded_at: string }[];

  const lastActivityByCandidate = new Map<string, string>();
  for (const row of historyRows) {
    if (!lastActivityByCandidate.has(row.candidate_id)) {
      lastActivityByCandidate.set(row.candidate_id, row.recorded_at);
    }
  }

  for (const candidate of candidates) {
    const lastActivity = lastActivityByCandidate.get(candidate.id) ?? candidate.admitted_at;
    const ageDays = (now - new Date(lastActivity).getTime()) / 86_400_000;
    if (ageDays >= STALL_DAYS) {
      waitingItems.push({
        type: "candidacy_stalled",
        candidateId: candidate.id,
        hostId: candidate.host_id,
        status: candidate.status,
        sinceDays: Math.floor(ageDays),
      });
    }
  }

  return { waitingItems };
}

type ReminderType = "candidacy_stalled" | "paid_awaiting_decision";

/** Same idempotent/cooldown shape as sendStalledOnboardingReminders in
 *  lib/ops/host-onboarding.ts -- one internal reminder per waiting item per
 *  run, never repeated inside REMINDER_COOLDOWN_DAYS. These reminders are
 *  operational (they go to Dorian/admin attention via the Founder digest,
 *  see Agent 10), not sent to the candidate -- nothing here contacts a
 *  Guide candidate directly or implies a decision has been made about them. */
export async function recordGuideOperationsReminders(
  sendFn: (item: GuideOperationsWaitingItem) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const { waitingItems } = await getGuideOperationsSnapshot();

  let sent = 0;
  let skippedCooldown = 0;

  for (const item of waitingItems) {
    const candidateId = item.type === "candidacy_stalled" ? item.candidateId : null;
    const reminderType: ReminderType = item.type;

    let query = admin
      .from("guide_candidate_reminders")
      .select("sent_at")
      .eq("reminder_type", reminderType)
      .order("sent_at", { ascending: false })
      .limit(1);
    query = candidateId
      ? query.eq("candidate_id", candidateId)
      : query.eq("host_id", item.hostId).is("candidate_id", null);

    const { data: lastReminder } = await query.maybeSingle();

    if (lastReminder) {
      const daysSince = (Date.now() - new Date(lastReminder.sent_at).getTime()) / 86_400_000;
      if (daysSince < REMINDER_COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    await sendFn(item);
    await admin.from("guide_candidate_reminders").insert({
      candidate_id: candidateId,
      host_id: item.hostId,
      reminder_type: reminderType,
    });
    sent += 1;
  }

  return { sent, skippedCooldown };
}

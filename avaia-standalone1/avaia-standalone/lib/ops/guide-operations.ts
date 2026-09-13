import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agent 7 (Guide Operations), Automation Blueprint Phase 3. Never evaluates
// a candidate's competency or invents a certification requirement -- only
// surfaces two mechanical waiting states.

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

const OPEN_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required", "paused", "hold"];

export type GuideOperationsWaitingItem =
  | { type: "paid_awaiting_decision"; hostId: string; paidAt: string; sinceDays: number }
  | { type: "candidacy_stalled"; candidateId: string; hostId: string; status: string; sinceDays: number };

export async function getGuideOperationsSnapshot(): Promise<{
  waitingItems: GuideOperationsWaitingItem[];
}> {
  const admin = createAdminClient();
  const now = Date.now();
  const waitingItems: GuideOperationsWaitingItem[] = [];

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

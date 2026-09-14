import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agent 7 (Guide Operations), Automation Blueprint Phase 3. Never evaluates
// a candidate's competency or invents a certification requirement -- only
// surfaces mechanical waiting states across the certification pipeline:
//   payment -> decision -> certification grant -> Toolkit authorization
// Recording a reminder never performs any of those steps itself; each
// remains the deliberate, human-performed admin action it already is (see
// app/admin/guide-candidates/[candidateId]/page.tsx).

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

const OPEN_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required", "paused", "hold"];

export type GuideOperationsWaitingItem =
  | { type: "paid_awaiting_decision"; hostId: string; paidAt: string; sinceDays: number }
  | { type: "candidacy_stalled"; candidateId: string; hostId: string; status: string; sinceDays: number }
  | { type: "certified_awaiting_grant"; candidateId: string; hostId: string; sinceDays: number }
  | { type: "certified_awaiting_toolkit_auth"; candidateId: string; hostId: string; sinceDays: number };

export async function getGuideOperationsSnapshot(): Promise<{
  waitingItems: GuideOperationsWaitingItem[];
}> {
  const admin = createAdminClient();
  const now = Date.now();
  const waitingItems: GuideOperationsWaitingItem[] = [];

  const [
    { data: paymentRows },
    { data: decisionRows },
    { data: candidateRows },
    { data: historyRowsRaw },
    { data: evidenceRowsRaw },
    { data: certificationRows },
    { data: toolkitAuthRows },
  ] = await Promise.all([
    admin.from("guide_certification_payments").select("host_id, paid_at").order("paid_at", { ascending: true }),
    admin
      .from("guide_certification_decisions")
      .select("candidate_id, host_id, decision, decision_date")
      .order("decision_date", { ascending: false }),
    admin.from("guide_candidates").select("id, host_id, status, admitted_at").in("status", OPEN_CANDIDACY_STATUSES),
    admin.from("guide_candidate_history").select("candidate_id, recorded_at").order("recorded_at", { ascending: false }),
    admin.from("guide_candidate_evidence").select("candidate_id, recorded_at").order("recorded_at", { ascending: false }),
    admin.from("guide_certifications").select("candidate_id, host_id, standing, certified_at"),
    admin
      .from("guide_platform_authorizations")
      .select("host_id")
      .eq("capability", "toolkit")
      .eq("status", "authorized"),
  ]);

  const payments = (paymentRows ?? []) as { host_id: string; paid_at: string }[];
  const decisions = (decisionRows ?? []) as {
    candidate_id: string;
    host_id: string;
    decision: string;
    decision_date: string;
  }[];
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

  const candidates = (candidateRows ?? []) as { id: string; host_id: string; status: string; admitted_at: string }[];
  const historyRows = (historyRowsRaw ?? []) as { candidate_id: string; recorded_at: string }[];
  const evidenceRows = (evidenceRowsRaw ?? []) as { candidate_id: string; recorded_at: string }[];

  // Audit finding #3.2: recording evidence or a certification decision are
  // both real candidacy activity, but neither writes guide_candidate_history
  // (recordCertificationDecision explicitly does not, by its own comment).
  // Folding all three timestamp sources together here fixes the false
  // positive of a candidate looking "stalled" while actively being worked.
  const lastActivityByCandidate = new Map<string, string>();
  const noteActivity = (candidateId: string, at: string) => {
    const existing = lastActivityByCandidate.get(candidateId);
    if (!existing || new Date(at).getTime() > new Date(existing).getTime()) {
      lastActivityByCandidate.set(candidateId, at);
    }
  };
  for (const row of historyRows) noteActivity(row.candidate_id, row.recorded_at);
  for (const row of evidenceRows) noteActivity(row.candidate_id, row.recorded_at);
  for (const row of decisions) noteActivity(row.candidate_id, row.decision_date);

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

  // Joint 2: a 'certified' decision with no guide_certifications row yet.
  // A candidate may have multiple decision rows over time (append-only);
  // only the most recent decision per candidate matters here.
  const certifiedCandidateIds = new Set((certificationRows ?? []).map((c: { candidate_id: string }) => c.candidate_id));
  const latestDecisionByCandidate = new Map<string, (typeof decisions)[number]>();
  for (const d of decisions) {
    if (!latestDecisionByCandidate.has(d.candidate_id)) latestDecisionByCandidate.set(d.candidate_id, d);
  }
  for (const decision of latestDecisionByCandidate.values()) {
    if (decision.decision !== "certified") continue;
    if (certifiedCandidateIds.has(decision.candidate_id)) continue;
    const ageDays = (now - new Date(decision.decision_date).getTime()) / 86_400_000;
    if (ageDays >= STALL_DAYS) {
      waitingItems.push({
        type: "certified_awaiting_grant",
        candidateId: decision.candidate_id,
        hostId: decision.host_id,
        sinceDays: Math.floor(ageDays),
      });
    }
  }

  // Joint 3: an active certification with no active Toolkit authorization.
  const toolkitAuthorizedHostIds = new Set((toolkitAuthRows ?? []).map((r: { host_id: string }) => r.host_id));
  for (const cert of (certificationRows ?? []) as {
    candidate_id: string;
    host_id: string;
    standing: string;
    certified_at: string;
  }[]) {
    if (cert.standing !== "active") continue;
    if (toolkitAuthorizedHostIds.has(cert.host_id)) continue;
    const ageDays = (now - new Date(cert.certified_at).getTime()) / 86_400_000;
    if (ageDays >= STALL_DAYS) {
      waitingItems.push({
        type: "certified_awaiting_toolkit_auth",
        candidateId: cert.candidate_id,
        hostId: cert.host_id,
        sinceDays: Math.floor(ageDays),
      });
    }
  }

  return { waitingItems };
}

type ReminderType =
  | "candidacy_stalled"
  | "paid_awaiting_decision"
  | "certified_awaiting_grant"
  | "certified_awaiting_toolkit_auth";

export async function recordGuideOperationsReminders(
  sendFn: (item: GuideOperationsWaitingItem) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  const { waitingItems } = await getGuideOperationsSnapshot();

  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const item of waitingItems) {
    const candidateId = item.type === "paid_awaiting_decision" ? null : item.candidateId;
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

    // A send that doesn't actually go out (missing recipient config, Resend
    // failure) must never be recorded as sent -- that would start this
    // item's 14-day cooldown even though nobody was told. sendFn is
    // expected to throw in that case (see the cron route); only a
    // successful send reaches the insert below, and one failure here
    // doesn't stop the rest of the batch from being attempted.
    try {
      await sendFn(item);
    } catch (err) {
      failed += 1;
      console.error("[guide-operations] reminder send failed", {
        item,
        error: err instanceof Error ? err.message : err,
      });
      continue;
    }
    await admin.from("guide_candidate_reminders").insert({
      candidate_id: candidateId,
      host_id: item.hostId,
      reminder_type: reminderType,
    });
    sent += 1;
  }

  return { sent, skippedCooldown, failed };
}

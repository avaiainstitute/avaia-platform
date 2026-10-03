import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAllStatuses,
  logCertificationEvent,
  formatDateLabel,
  type CertificationStatus,
} from "@/lib/certification-renewal";

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

// ---------------------------------------------------------------------------
// Certification lifecycle (individual 365-day renewal cycle, CE, Inactive)
//
// The same agent now also knows the renewal lifecycle (migration 0082,
// lib/certification-renewal.ts, which holds every rule). What this agent
// does automatically:
//   * marks an ACTIVE certification INACTIVE when its 365-day period has
//     ended and the renewal requirements are not all met (a fail-closed,
//     policy-locked, human-reversible consequence, never a deletion);
//   * records when an inactive certification first reaches the end of the
//     60-month reactivation window (RECERTIFICATION_REQUIRED);
//   * sends the Guide a renewal reminder at 90/60/30/14/7 days before
//     expiration, once per band per period.
// What it deliberately never does: certify, recertify, renew, reactivate,
// admit, approve a CE credit, or decide good standing. A period that ended
// with every requirement already met is NOT lapsed; it waits for a human to
// confirm the renewal and is surfaced to Dorian instead. It also never
// touches guide_platform_authorizations: authorization history stays on the
// Guide while inactive, the gates in lib/guide.ts just stop honoring it.
// ---------------------------------------------------------------------------

export type RenewalReminderItem = {
  certificationId: string;
  hostId: string;
  daysBefore: number;
  status: CertificationStatus;
};

export type CertificationLifecycleResult = {
  lapsed: number;
  recertificationFlagged: number;
  remindersSent: number;
  remindersSkipped: number;
  remindersFailed: number;
  errors: string[];
};

export async function runCertificationLifecycle(
  sendRenewalReminder: (item: RenewalReminderItem) => Promise<void>,
  now: Date = new Date()
): Promise<CertificationLifecycleResult> {
  const admin = createAdminClient();
  const statuses = await loadAllStatuses(admin, now);
  const result: CertificationLifecycleResult = {
    lapsed: 0,
    recertificationFlagged: 0,
    remindersSent: 0,
    remindersSkipped: 0,
    remindersFailed: 0,
    errors: [],
  };

  for (const s of statuses) {
    // 1. Active -> Inactive. Guarded on the exact expiration the decision
    //    was made against, so a renewal confirmed a moment ago is never
    //    overwritten.
    if (s.lifecycle === "lapse_pending" && s.cycleEndsAt) {
      const { data, error } = await admin
        .from("guide_certifications")
        .update({
          standing: "inactive",
          inactive_since: s.cycleEndsAt,
          standing_changed_at: now.toISOString(),
          standing_changed_by: null,
        })
        .eq("id", s.certificationId)
        .eq("standing", "active")
        .eq("cycle_ends_at", s.cycleEndsAt)
        .select("id");
      if (error) {
        result.errors.push(`lapse ${s.certificationId}: ${error.message}`);
      } else if (data && data.length > 0) {
        result.lapsed += 1;
        await logCertificationEvent(
          admin,
          s.candidateId,
          `Certification became INACTIVE: the 365-day period ended ${formatDateLabel(s.cycleEndsAt)} without the renewal requirements being met. ` +
            `${s.renewal.blockers.join(" ")} ` +
            `The certification record and any Program Authorization history are preserved. It may be reactivated within the reactivation window.`,
          null
        );
      }
      continue;
    }

    // 2. Reached the end of the reactivation window.
    if (s.lifecycle === "recertification_required" && !s.recertificationRequiredAt) {
      const { data, error } = await admin
        .from("guide_certifications")
        .update({ recertification_required_at: now.toISOString() })
        .eq("id", s.certificationId)
        .is("recertification_required_at", null)
        .select("id");
      if (error) {
        result.errors.push(`recertification flag ${s.certificationId}: ${error.message}`);
      } else if (data && data.length > 0) {
        result.recertificationFlagged += 1;
        await logCertificationEvent(
          admin,
          s.candidateId,
          "RECERTIFICATION REQUIRED: this certification has now been inactive for the full reactivation window. It can no longer be reactivated; it must go through the human-governed AVAIA certification process again. The historical certification record is preserved.",
          null
        );
      }
      continue;
    }

    // 3. Renewal reminders to the Guide, one per band per period.
    if (s.nextReminderBand !== null && s.cycleEndsAt) {
      const band = s.nextReminderBand;
      const { data: already } = await admin
        .from("guide_certification_renewal_reminders")
        .select("id")
        .eq("certification_id", s.certificationId)
        .eq("cycle_ends_at", s.cycleEndsAt)
        .eq("days_before", band)
        .maybeSingle();
      if (already) {
        result.remindersSkipped += 1;
        continue;
      }
      try {
        await sendRenewalReminder({ certificationId: s.certificationId, hostId: s.hostId, daysBefore: band, status: s });
      } catch (err) {
        // A send that did not go out is never recorded as sent, so the
        // next run retries it.
        result.remindersFailed += 1;
        console.error("[guide-operations] renewal reminder send failed", {
          certificationId: s.certificationId,
          error: err instanceof Error ? err.message : err,
        });
        continue;
      }
      const { error: insertError } = await admin.from("guide_certification_renewal_reminders").insert({
        certification_id: s.certificationId,
        host_id: s.hostId,
        cycle_ends_at: s.cycleEndsAt,
        days_before: band,
      });
      // 23505 = a concurrent run already recorded it; harmless.
      if (insertError && (insertError as { code?: string }).code !== "23505") {
        result.errors.push(`reminder log ${s.certificationId}: ${insertError.message}`);
      }
      result.remindersSent += 1;
    }
  }

  return result;
}

export type CertificationOpsSnapshot = {
  /** A human action only an admin can take. Already phrased for the
   *  Founder Digest. */
  needsDorian: string[];
  /** Visibility only. */
  waiting: string[];
  /** Certifications that became inactive in the last 24 hours. */
  lapsedLast24h: number;
};

/** Read-only. Never mutates, never sends. Resolves a Guide's email only so
 *  the digest line is actionable; no Host/Journey content is ever read. */
export async function getCertificationOpsSnapshot(now: Date = new Date()): Promise<CertificationOpsSnapshot> {
  const admin = createAdminClient();
  const statuses = await loadAllStatuses(admin, now);
  const since = now.getTime() - 86_400_000;

  const whoCache = new Map<string, string>();
  const who = async (hostId: string): Promise<string> => {
    const cached = whoCache.get(hostId);
    if (cached) return cached;
    const { data } = await admin.auth.admin.getUserById(hostId);
    const label = data?.user?.email ?? `Host ${hostId}`;
    whoCache.set(hostId, label);
    return label;
  };

  const snapshot: CertificationOpsSnapshot = { needsDorian: [], waiting: [], lapsedLast24h: 0 };

  for (const s of statuses) {
    if (s.standing === "inactive" && s.standingChangedAt && new Date(s.standingChangedAt).getTime() >= since) {
      snapshot.lapsedLast24h += 1;
    }

    if (s.lifecycle === "renewal_ready_awaiting_confirmation") {
      snapshot.needsDorian.push(
        `${await who(s.hostId)}: certification period ended ${formatDateLabel(s.cycleEndsAt)} with every renewal requirement met -- waiting on your confirmation to renew (not lapsed while it waits).`
      );
    } else if (s.lifecycle === "active" && s.renewal.allMet && s.daysRemaining !== null && s.daysRemaining <= 14) {
      snapshot.needsDorian.push(
        `${await who(s.hostId)}: all renewal requirements met, period ends in ${s.daysRemaining} day(s) -- ready for your confirmation.`
      );
    } else if (s.lifecycle === "active" && !s.renewal.allMet && s.daysRemaining !== null && s.daysRemaining <= 30) {
      snapshot.waiting.push(
        `${await who(s.hostId)}: certification period ends in ${s.daysRemaining} day(s) and renewal is not yet complete (CE ${s.ce.approvedInPeriod}/${s.ce.requiredCredits}; ${s.payment.status === "paid" ? "fee received" : "fee not yet received"}; Ethics ${s.ethics.metForRenewal ? "OK" : "needed"}). The Guide is being reminded automatically.`
      );
    } else if (s.lifecycle === "lapse_pending") {
      snapshot.waiting.push(
        `${await who(s.hostId)}: certification period ended without renewal; will be marked inactive on the next Guide Operations run.`
      );
    }

    if (s.lifecycle === "inactive_reactivatable" && s.reactivation) {
      if (s.reactivation.systemChecksPass) {
        snapshot.needsDorian.push(
          `${await who(s.hostId)}: inactive ${s.inactivity?.monthsInactive ?? "?"} month(s), reactivation fee received and Ethics current -- ready for your reactivation decision (you will be asked to attest good standing and the applicable CE requirement).`
        );
      }
    }

    if (
      s.lifecycle === "recertification_required" &&
      s.recertificationRequiredAt &&
      new Date(s.recertificationRequiredAt).getTime() >= since
    ) {
      snapshot.needsDorian.push(
        `${await who(s.hostId)}: crossed the end of the reactivation window -- RECERTIFICATION REQUIRED. This can only go back through the human-governed certification process.`
      );
    }
  }

  return snapshot;
}

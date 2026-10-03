import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadAllStatuses,
  logCertificationEvent,
  formatDateLabel,
  type CertificationStatus,
} from "@/lib/certification-renewal";

// Guide Operations: the Guide's STANDING after certification -- the
// individual 365-day renewal cycle, continuing education, Active -> Inactive,
// the end of the reactivation window, and renewal reminders to the Guide.
//
// Everything about the CANDIDATE pipeline (stalled candidacy, certified but
// no certification record, certified but no Toolkit authorization, ready for
// review, Boundary Gate / Practicum waiting) is Certification Operations'
// (lib/certification-operations.ts) and is decided in exactly one place. The
// four candidate rules that used to live here ran on their own thresholds,
// did not count classroom activity, and emailed separately, so they were
// retired in the Needs-Dorian consolidation; the "paid, awaiting decision"
// rule watched the retired $4,500 enrollment path and no longer applies.
// (The guide_candidate_reminders table is left in place as history.)

// ---------------------------------------------------------------------------
// Certification lifecycle (individual 365-day renewal cycle, CE, Inactive)
//
// This agent runs the renewal lifecycle (migration 0082,
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

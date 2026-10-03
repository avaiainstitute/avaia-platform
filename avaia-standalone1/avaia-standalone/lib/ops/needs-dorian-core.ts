import type { CertificationOperationsRecord } from "@/lib/certification-operations";

// THE ONE SOURCE OF "WHAT NEEDS DORIAN?"
//
// Every view of this question -- the daily Founder Digest email and the live
// /admin/today page -- renders the snapshot built here. Neither view decides
// anything on its own, so they can no longer drift apart.
//
// Nothing is stored. The snapshot is computed live from the underlying
// records, so an item disappears the moment the thing it describes is
// resolved (a decision is recorded, a follow-up is done, a failed job
// recovers). The only thing a person ever has to "clear" is a Companion
// escalation, which has its own explicit "Mark handled" because nothing else
// records that a person responded.
//
// What belongs where:
//   people / decisions / approvals / problems  -- need a person to act; counted.
//   opportunities                              -- research finds awaiting a first look; not counted.
//   watching                                   -- visibility only; nothing to do; not counted.
// Routine successful activity never appears. Metadata only: no conversation,
// Workbook, reflection, or Room content is read to build this.

export type NeedsItem = {
  /** Unique within a snapshot; stable for the same underlying condition. */
  key: string;
  text: string;
  /** Where to act (shown as a link on /admin/today). */
  href?: string;
  /** Extra context for /admin/today ONLY -- never put in the emailed digest. */
  detail?: string;
  /** Present when the item can only be cleared by a person saying "handled". */
  resolve?: { kind: "companion_escalation"; id: string };
};

export type NeedsBucket = { count: number; items: NeedsItem[] };

/** What one operational capability reports each time it is evaluated: the items
 *  that need a person (by bucket) plus how many records it looked at, so that
 *  System Checks can prove it is actually operating, not merely present. */
export type CapabilityResult = {
  key: string;
  label: string;
  /** How many records this capability examined. */
  evaluated: number;
  people?: NeedsItem[];
  decisions?: NeedsItem[];
  approvals?: NeedsItem[];
  problems?: NeedsItem[];
  watching?: NeedsItem[];
};

/** The recorded proof that a capability ran (stored with the digest cron run). */
export type CapabilityEvidence = {
  key: string;
  label: string;
  ok: boolean;
  evaluated: number;
  /** Items that need a person (people + decisions + approvals + problems). */
  flagged: number;
  error?: string;
};

export type NeedsDorianSnapshot = {
  generatedAt: string;
  people: NeedsBucket;
  decisions: NeedsBucket;
  approvals: NeedsBucket;
  problems: NeedsBucket;
  opportunities: NeedsBucket;
  watching: NeedsBucket;
  /** What AVAIA handles on its own (reassurance, not a task list). */
  automatic: string[];
  /** people + decisions + approvals + problems. */
  totalNeeded: number;
  /** Proof, per operational capability, that it was evaluated for this snapshot. */
  capabilityEvidence?: CapabilityEvidence[];
};

const bucket = (items: NeedsItem[]): NeedsBucket => ({ count: items.length, items });

export const AUTOMATIC_SUMMARY: string[] = [
  "Every new AVAIA form submission is saved and acknowledged automatically.",
  "Routine submissions (no flagged review needed) receive an automatic reply -- nothing further is required.",
  "Hosts who stall mid-conversation receive a gentle, rate-limited reminder automatically (no more than one per stage per reminder window).",
  "Partnership, Programs & Experiences, and speaking/conference prospects are researched automatically once a week -- never contacted automatically, only discovered and described for your review.",
  "The website, Journey, Shared Room, database, scheduled jobs, and the live deployment are checked automatically every six hours -- you only hear about it when something needs your attention.",
  "Stripe subscription state is checked against AVAIA's own access records daily -- an entitlement that should have ended is revoked automatically; anything else is only ever surfaced, never auto-granted.",
  "Guardian consents that stall are reminded to the owning Guide automatically, rate-limited so nobody is chased more than once every two weeks.",
  "An unaccepted Family Membership invitation is reminded directly to the invited person automatically, rate-limited the same way.",
  "Certified Guides are reminded automatically at 90, 60, 30, 14, and 7 days before their individual 365-day certification period ends. A period that ends without every renewal requirement met moves the certification to inactive automatically (never deleted); nothing is ever renewed, reactivated, or recertified automatically.",
  "Certification candidates who go quiet receive a gentle check-in after about a week (at most one every two weeks). You are told about a quiet candidate only as a heads-up. Admission, the Boundary Gate, the Observed Practicum, standing, and the certification decision always stay with people.",
];

// ---------------------------------------------------------------------------
// Certification candidates: the one place their pipeline conditions become items
// ---------------------------------------------------------------------------

/** Turns the candidate pipeline's records into items. Pure -- no database,
 *  no clock reads except the optional `now`. Each condition is reported ONCE
 *  (lib/certification-operations.ts emits one coded exception per root
 *  cause); this only decides where each code belongs and how it reads. */
export function classifyCertificationRecords(
  records: CertificationOperationsRecord[],
  label: (hostId: string) => string,
  now: number = Date.now()
): { decisions: NeedsItem[]; problems: NeedsItem[]; watching: NeedsItem[] } {
  const decisions: NeedsItem[] = [];
  const problems: NeedsItem[] = [];
  const watching: NeedsItem[] = [];

  for (const r of records) {
    const who = label(r.hostId);
    const href = `/admin/guide-candidates/${r.candidateId}`;
    const key = (code: string) => `cert:${r.candidateId}:${code}`;

    for (const ex of r.exceptions) {
      switch (ex.code) {
        case "ready_for_review":
          decisions.push({
            key: key(ex.code),
            href,
            text: `${who}: ready for your certification decision (${ex.detail}${r.readyForReviewNotes ? `; your note: ${r.readyForReviewNotes}` : ""}).`,
          });
          break;
        case "gate_waiting":
        case "practicum_waiting":
          decisions.push({ key: key(ex.code), href, text: `${who}: ${ex.detail}` });
          break;
        case "critical_fail":
        case "missing_certification":
        case "activation_pending":
          decisions.push({ key: key(ex.code), href, text: `${who}: ${ex.detail}` });
          break;
        case "mismatch_no_decision":
          problems.push({ key: key(ex.code), href, text: `${who}: ${ex.detail}` });
          break;
        case "stale": {
          const days = r.lastActivityAt ? Math.floor((now - new Date(r.lastActivityAt).getTime()) / 86_400_000) : null;
          watching.push({
            key: key(ex.code),
            href,
            text: `${who}: no activity${days !== null ? ` in ${days} day(s)` : ""} (the candidate has been gently checked in on; nothing for you to do unless you want to reach out).`,
          });
          break;
        }
      }
    }

    // The one rule skipped for a designated test account is stated, not hidden.
    if (r.designatedTestAccount && r.certification && !r.decision) {
      watching.push({
        key: key("test_account"),
        href,
        text: `${who}: designated test account (founder_test); it has a certification but no certification decision on file, which is expected, so it is not flagged.`,
      });
    }

    if (r.derivedState === "boundary_gate_eligible") {
      watching.push({ key: key("gate_eligible"), href, text: `${who}: eligible for the Boundary Gate, waiting for it to be arranged.` });
    }
    if (r.derivedState === "practicum_eligible") {
      watching.push({ key: key("practicum_eligible"), href, text: `${who}: eligible for the Observed Practicum, waiting for it to be arranged.` });
    }
  }

  const open = records.filter((r) => r.derivedState !== "lifecycle_closed");
  const inTraining = open.filter((r) => r.derivedState === "training_active" || r.derivedState === "practice_eligible").length;
  if (inTraining > 0) {
    watching.push({ key: "cert:aggregate:in_training", text: `${inTraining} certification candidate(s) currently working through the classroom and evidence steps.` });
  }
  const finished = open.filter((r) => r.progress.lessonsTotal > 0 && r.progress.lessonsSelfCheckedComplete >= r.progress.lessonsTotal).length;
  if (finished > 0) {
    watching.push({
      key: "cert:aggregate:finished_lessons",
      text: `${finished} certification candidate(s) have finished every currently available lesson (visibility only: this advances nothing, and the Boundary Gate, Observed Practicum, and certification decision remain yours).`,
    });
  }

  return { decisions, problems, watching };
}

// ---------------------------------------------------------------------------
// Snapshot assembly and the digest's view of it
// ---------------------------------------------------------------------------

export function assembleSnapshot(parts: {
  people: NeedsItem[];
  decisions: NeedsItem[];
  approvals: NeedsItem[];
  problems: NeedsItem[];
  opportunities: NeedsItem[];
  watching: NeedsItem[];
  capabilityEvidence?: CapabilityEvidence[];
}): NeedsDorianSnapshot {
  const snapshot: NeedsDorianSnapshot = {
    generatedAt: new Date().toISOString(),
    people: bucket(parts.people),
    decisions: bucket(parts.decisions),
    approvals: bucket(parts.approvals),
    problems: bucket(parts.problems),
    opportunities: bucket(parts.opportunities),
    watching: bucket(parts.watching),
    automatic: AUTOMATIC_SUMMARY,
    totalNeeded: parts.people.length + parts.decisions.length + parts.approvals.length + parts.problems.length,
    capabilityEvidence: parts.capabilityEvidence,
  };
  return snapshot;
}

/** How the emailed digest presents a snapshot. The digest adds its own
 *  informational sections (what happened in the last day), but WHAT NEEDS
 *  DORIAN comes only from here, in the same order everywhere. */
export function snapshotToDigestSections(s: NeedsDorianSnapshot): {
  needsDorian: string[];
  waiting: string[];
  opportunities: string[];
  priorities: string[];
  automatic: string[];
} {
  const needsDorian = [...s.problems.items, ...s.decisions.items, ...s.people.items, ...s.approvals.items].map((i) => i.text);
  return {
    needsDorian,
    waiting: s.watching.items.map((i) => i.text),
    opportunities: s.opportunities.items.map((i) => i.text),
    priorities: needsDorian.slice(0, 5),
    automatic: s.automatic,
  };
}


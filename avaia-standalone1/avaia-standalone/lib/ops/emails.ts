import { escapeHtml } from "@/lib/resend";

const STAGE_LABEL: Record<string, string> = {
  iap_stalled: "your Initial AVAIA Pathway conversation",
  cat_eligible_no_start: "your Initial AVAIA Pathway conversation",
  cat_stalled: "your CAT conversation",
  innercompass_stalled: "your InnerCompass conversation",
};

export function hostOnboardingReminderEmailHtml({
  reminderType,
  journeyUrl,
}: {
  reminderType: "iap_stalled" | "cat_eligible_no_start" | "cat_stalled" | "innercompass_stalled";
  journeyUrl: string;
}): string {
  const whatStalled = STAGE_LABEL[reminderType] ?? "your AVAIA conversation";
  return `
    <p>Hi,</p>
    <p>You started ${whatStalled} a little while ago. There's no deadline here, and nothing
    about your progress has been lost -- it's still exactly where you left it, whenever you're
    ready to pick it back up.</p>
    <p><a href="${journeyUrl}">Continue whenever you're ready</a></p>
    <p style="color:#888">If you'd rather not continue right now, you can ignore this --
    we won't send another reminder about this for a while.</p>
  `.trim();
}

export function guideOperationsWaitingNotificationEmailHtml({
  type,
  hostId,
  hostEmail,
  sinceDays,
  status,
}: {
  type: "candidacy_stalled" | "paid_awaiting_decision" | "certified_awaiting_grant" | "certified_awaiting_toolkit_auth";
  hostId: string;
  hostEmail?: string | null;
  sinceDays: number;
  status?: string;
}): string {
  const heading = {
    paid_awaiting_decision: "Certification payment awaiting a decision",
    candidacy_stalled: "Guide candidacy waiting on next step",
    certified_awaiting_grant: "Certified decision awaiting the certification grant",
    certified_awaiting_toolkit_auth: "Certification awaiting Toolkit authorization",
  }[type];
  const body = {
    paid_awaiting_decision: `A candidate paid for certification ${sinceDays} day(s) ago and no certification decision has been recorded yet.`,
    candidacy_stalled: `A candidacy (status: ${escapeHtml(status ?? "unknown")}) has had no recorded activity in ${sinceDays} day(s).`,
    certified_awaiting_grant: `A 'certified' decision was recorded ${sinceDays} day(s) ago, but the certification itself has not yet been granted.`,
    certified_awaiting_toolkit_auth: `This person's certification has been active for ${sinceDays} day(s), but Toolkit authorization has not yet been granted.`,
  }[type];
  return `
    <h2>${heading}</h2>
    <p>${body}</p>
    <p><strong>Host ID:</strong> ${escapeHtml(hostId)}</p>
    ${hostEmail ? `<p><strong>Host email:</strong> ${escapeHtml(hostEmail)}</p>` : ""}
    <p style="color:#888">This is a scheduling notice only -- it does not include any evaluation
    notes, application content, or a recommendation. Review the candidate's record directly to
    decide next steps.</p>
  `.trim();
}

/** Renewal reminder to the Guide themselves (90/60/30/14/7 days before
 *  their individual 365-day certification period ends). Shows only the
 *  Guide's own certification standing -- expiration, days remaining, CE
 *  progress, Ethics, renewal payment -- never Host, Journey, or participant
 *  content. Nothing here renews anything or implies renewal is automatic:
 *  payment alone and CE alone are each not renewal, and a human confirms it. */
export function certificationRenewalReminderEmailHtml({
  daysRemaining,
  expiresOn,
  ceApproved,
  ceRequired,
  ethicsLine,
  paymentLine,
  statusUrl,
}: {
  daysRemaining: number;
  expiresOn: string;
  ceApproved: number;
  ceRequired: number;
  ethicsLine: string;
  paymentLine: string;
  statusUrl: string;
}): string {
  return `
    <h2>Your AVAIA Certified Guide period ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}</h2>
    <p>Your current 365-day certification period ends on <strong>${escapeHtml(expiresOn)}</strong>.
    To stay actively certified for the next period, three things all need to be complete before then:
    your approved continuing education credits, any required Ethics coursework, and the annual
    renewal fee. Any one of them on its own is not renewal.</p>
    <ul>
      <li><strong>Continuing education:</strong> ${ceApproved} of ${ceRequired} approved credits this period</li>
      <li><strong>Ethics:</strong> ${escapeHtml(ethicsLine)}</li>
      <li><strong>Renewal fee:</strong> ${escapeHtml(paymentLine)}</li>
    </ul>
    <p><a href="${statusUrl}">See your full certification status</a></p>
    <p style="color:#888">If your period ends without renewal, your certification is not deleted. It
    becomes inactive, your record and any Program Authorization history are kept, and it can be
    reactivated within five years. While inactive, the Guide Toolkit is not available.</p>
  `.trim();
}

/** Mirrors the original invite email's own copy and accept-link shape
 *  (app/api/family/invite/route.ts) -- same destination, same tone, just
 *  a reminder rather than the first ask. */
export function familyInviteReminderEmailHtml({ acceptUrl }: { acceptUrl: string }): string {
  return `
    <p>You were invited to join a Family AVAIA Membership a little while ago, and the invitation
    is still open.</p>
    <p>Each person keeps their own private AVAIA account, Journey, and Workbook, joining a Family
    plan only shares payment, never your private conversations.</p>
    <p><a href="${acceptUrl}">Accept the invitation</a></p>
    <p style="color:#888">If you'd rather not join, you can safely ignore this -- we won't send
    another reminder about this for a while.</p>
  `.trim();
}

export function guardianConsentReminderEmailHtml({
  type,
  participantName,
  sinceDays,
}: {
  type: "consent_pending" | "assent_not_confirmed";
  participantName: string;
  sinceDays: number;
}): string {
  const heading =
    type === "consent_pending" ? "Guardian consent still pending" : "Youth assent not yet confirmed";
  const body =
    type === "consent_pending"
      ? `The guardian consent link for ${escapeHtml(participantName)} was sent ${sinceDays} day(s) ago and hasn't been confirmed yet. This participant can't be cleared to start until the guardian confirms.`
      : `Guardian consent for ${escapeHtml(participantName)} has been active for ${sinceDays} day(s), but Youth assent hasn't been confirmed on their record yet. This participant can't be cleared to start until that's confirmed.`;
  return `
    <h2>${heading}</h2>
    <p>${body}</p>
    <p style="color:#888">This is a scheduling notice only -- no consent, disclosure, or Youth
    content is included here. Review this participant's record directly to decide whether to
    follow up with the guardian.</p>
  `.trim();
}

export function founderDigestEmailHtml({
  dateLabel,
  whatHappened,
  automatic,
  waiting,
  needsDorian,
  priorities,
  opportunities,
}: {
  dateLabel: string;
  whatHappened: string[];
  automatic: string[];
  waiting: string[];
  needsDorian: string[];
  priorities: string[];
  /** New outbound-research prospects (Agents 3/4/8), optional and additive
   *  -- default [] keeps every pre-existing call site correct with no
   *  change required at its own call site. */
  opportunities?: string[];
}): string {
  const section = (title: string, lines: string[], emptyLabel: string) => `
    <h2 style="margin-bottom:4px">${escapeHtml(title)}</h2>
    ${
      lines.length
        ? `<ul style="margin-top:4px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p style="color:#888;margin-top:4px">${escapeHtml(emptyLabel)}</p>`
    }
  `;

  return `
    <h1>AVAIA + Pink Shoelace -- Daily Operating Summary</h1>
    <p style="color:#888">${escapeHtml(dateLabel)}</p>
    ${section("WHAT HAPPENED", whatHappened, "Nothing new since the last summary.")}
    ${section("WHAT IS BEING HANDLED AUTOMATICALLY", automatic, "Nothing currently in automated handling.")}
    ${section("OPPORTUNITIES", opportunities ?? [], "No new research-found opportunities today.")}
    ${section("WHAT IS WAITING", waiting, "Nothing waiting.")}
    ${section("WHAT NEEDS DORIAN", needsDorian, "Nothing needs your attention today.")}
    ${section("TODAY'S PRIORITIES", priorities, "No specific priorities surfaced today.")}
  `.trim();
}

// ---------------------------------------------------------------------------
// Certification Classroom / Companion / Operations (ported from main, adapted
// to production). Fixed templates: nothing here is generated by a model.
// ---------------------------------------------------------------------------

const ESCALATION_CATEGORY_LABEL: Record<string, string> = {
  crisis: "Possible crisis content detected",
  waiver_request: "Candidate asked to waive or skip a requirement",
  evaluation_dispute: "Candidate disputed a recorded evaluation",
  judgment_territory: "Candidate asked about a Boundary Gate / Practicum judgment",
  no_confident_match: "Candidate asked a content question the Companion could not confidently answer",
};

export function certificationCompanionEscalationEmailHtml({
  category,
  hostId,
  candidateId,
  note,
}: {
  category: string;
  hostId: string;
  candidateId: string;
  note?: string | null;
}): string {
  const label = ESCALATION_CATEGORY_LABEL[category] ?? "Certification Companion escalation";
  return `
    <h2>${escapeHtml(label)}</h2>
    <p>The AVAIA Certification Companion flagged a conversation that needs a person.</p>
    <p><strong>Host ID:</strong> ${escapeHtml(hostId)}</p>
    <p><strong>Candidate ID:</strong> ${escapeHtml(candidateId)}</p>
    ${note ? `<p><strong>Candidate's message (verbatim, truncated):</strong></p><p style="white-space:pre-wrap">${escapeHtml(note)}</p>` : ""}
    ${
      category === "crisis"
        ? `<p style="color:#8f3b34"><strong>988</strong> (call or text) · <strong>911</strong> for immediate danger · text <strong>HOME</strong> to <strong>741741</strong></p>`
        : ""
    }
    <p style="color:#888">This is a routing notice only -- the Companion did not evaluate, decide,
    or waive anything. Review the conversation directly to decide next steps.</p>
  `.trim();
}

/** Sent directly to a certification candidate whose classroom work has been
 *  quiet. Warm and generic: no urgency, no deadline, nothing about what is or
 *  is not complete. */
export function certificationCompanionCheckinEmailHtml({ classroomUrl }: { classroomUrl: string }): string {
  return `
    <p>Hi,</p>
    <p>It's been a little while since you last worked on your AVAIA Guide Certification.
    There's no deadline attached to this note -- everything you've already done is saved exactly
    as you left it.</p>
    <p>Whenever you're ready, you can pick up right where you stopped.</p>
    <p><a href="${classroomUrl}">Open your certification classroom</a></p>
    <p style="color:#888">If you'd rather not continue right now, you can ignore this -- we won't
    send another check-in about this for a while.</p>
  `.trim();
}

export function certificationOperationsExceptionEmailHtml({
  category,
  detail,
  derivedState,
  hostId,
  candidateId,
}: {
  category: string;
  detail: string;
  derivedState: string;
  hostId: string;
  candidateId: string;
}): string {
  return `
    <h2>Certification Operations: ${escapeHtml(category)}</h2>
    <p>${escapeHtml(detail)}</p>
    <p><strong>Operational state:</strong> ${escapeHtml(derivedState)}</p>
    <p><strong>Candidate ID:</strong> ${escapeHtml(candidateId)}</p>
    <p><strong>Host ID:</strong> ${escapeHtml(hostId)}</p>
    <p style="color:#888">This is a mechanical workflow notice only -- it does not evaluate
    competency, grade a Boundary Gate or Practicum, determine Critical Fail, or certify anyone.
    Review the candidate's record directly in /admin/guide-candidates to decide next steps.</p>
  `.trim();
}

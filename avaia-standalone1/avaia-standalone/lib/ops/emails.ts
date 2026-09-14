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

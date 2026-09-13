import { escapeHtml } from "@/lib/resend";

const STAGE_LABEL: Record<string, string> = {
  iap_stalled: "your Initial AVAIA Pathway conversation",
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
  sinceDays,
  status,
}: {
  type: "candidacy_stalled" | "paid_awaiting_decision";
  hostId: string;
  sinceDays: number;
  status?: string;
}): string {
  const heading =
    type === "paid_awaiting_decision"
      ? "Certification payment awaiting a decision"
      : "Guide candidacy waiting on next step";
  const body =
    type === "paid_awaiting_decision"
      ? `A candidate paid for certification ${sinceDays} day(s) ago and no certification decision has
         been recorded yet.`
      : `A candidacy (status: ${escapeHtml(status ?? "unknown")}) has had no recorded activity in
         ${sinceDays} day(s).`;
  return `
    <h2>${heading}</h2>
    <p>${body}</p>
    <p><strong>Host ID:</strong> ${escapeHtml(hostId)}</p>
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
}: {
  dateLabel: string;
  whatHappened: string[];
  automatic: string[];
  waiting: string[];
  needsDorian: string[];
  priorities: string[];
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
    ${section("WHAT IS WAITING", waiting, "Nothing waiting.")}
    ${section("WHAT NEEDS DORIAN", needsDorian, "Nothing needs your attention today.")}
    ${section("TODAY'S PRIORITIES", priorities, "No specific priorities surfaced today.")}
  `.trim();
}

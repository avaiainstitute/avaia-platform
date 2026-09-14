import "server-only";
import { sendEmail, escapeHtml } from "@/lib/resend";

// Automation audit finding #4 (silent entitlement-grant-failure alerting)
// and #3.3 (immediate certification-payment notice). A single, small,
// reused chokepoint for "something needs Dorian to know about right now,"
// distinct from the daily founder digest -- this is for things that
// shouldn't wait until tomorrow's summary. Never includes conversation,
// Workbook, Room, or recognition content; only operational metadata
// (ids, event types, error text) already available to whichever caller
// invokes it.

function alertRecipient(): string | undefined {
  return process.env.CONTACT_NOTIFICATION_EMAIL || process.env.FOUNDER_DIGEST_EMAIL;
}

/** Best-effort and non-blocking: a failure here must never surface as a
 *  failure of whatever the caller was actually doing (a Stripe webhook
 *  must still return 200, a checkout must still complete). Logs via
 *  console.error same as the rest of this codebase if it can't send. */
export async function alertOps(subject: string, bodyLines: string[]): Promise<void> {
  const to = alertRecipient();
  if (!to) {
    console.error("[ops-alert] no CONTACT_NOTIFICATION_EMAIL/FOUNDER_DIGEST_EMAIL configured; alert not sent:", {
      subject,
      bodyLines,
    });
    return;
  }
  try {
    const html = `<h2>${escapeHtml(subject)}</h2>${bodyLines
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("")}`;
    await sendEmail({ to, subject, html });
  } catch (err) {
    console.error("[ops-alert] failed to send alert email:", {
      subject,
      error: err instanceof Error ? err.message : err,
    });
  }
}

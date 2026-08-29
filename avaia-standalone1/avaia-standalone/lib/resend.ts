import "server-only";

/**
 * Server-only Resend sender. Calls the REST API directly with fetch rather
 * than pulling in the `resend` SDK — the SDK carries transitive dependencies
 * (postal-mime, standardwebhooks) that would need a real `npm install` to
 * lock correctly, which isn't available in this environment; a single POST
 * doesn't need the SDK.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set in this deployment.");
  const from = process.env.RESEND_FROM_EMAIL || "AVAIA <noreply@avaiainstitute.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}

/** The Workbook-sharing invite email — sent when a Host shares with an email
 *  that has no AVAIA account yet. Access is granted automatically the moment
 *  that email signs up (see handle_new_user() in supabase/schema.sql). */
export function inviteEmailHtml({
  ownerLabel,
  scopeLabel,
  signUpUrl,
}: {
  ownerLabel: string;
  scopeLabel: string;
  signUpUrl: string;
}): string {
  return `
    <h2>You've been invited to AVAIA</h2>
    <p>${ownerLabel} has shared ${scopeLabel} with you on AVAIA.</p>
    <p>Create a free AVAIA account with this email address to view it:</p>
    <p><a href="${signUpUrl}">${signUpUrl}</a></p>
    <p style="color:#888">If you weren't expecting this, you can safely ignore this email.</p>
  `.trim();
}

/** Unlike ownerLabel/scopeLabel/signUpUrl above (all server-controlled
 *  strings), the contact form below interpolates raw Host-typed text into
 *  HTML for the first time in this file -- escape it so a name or message
 *  containing HTML can't inject markup into the notification email. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The AVAIA Member Welcome email — sent once, from the Stripe webhook,
 *  at the exact moment a new active entitlement is actually granted (never
 *  on a webhook redelivery for an already-active member — see
 *  grantEntitlement's own idempotency check in
 *  app/api/stripe/webhook/route.ts, which is what this reuses to decide
 *  whether to send). Transactional — triggered by the Host's own payment,
 *  not a scheduled/marketing send, so no unsubscribe mechanism is needed
 *  for it. journeyUrl is server-constructed (never Host-typed), so unlike
 *  contactSubmissionEmailHtml below it doesn't need escaping. */
export function memberWelcomeEmailHtml({ journeyUrl }: { journeyUrl: string }): string {
  return `
    <p>You started with a conversation.</p>
    <p>Now you have a place to continue it.</p>
    <p>Your AVAIA Membership gives you access to the complete AVAIA Journey, your continuing
    Workbook, the member Living Library, Unsung Heroes, and the conversations and tools
    available to AVAIA members.</p>
    <p>You don't have to use everything at once.</p>
    <p>Start with what brought you here.</p>
    <p>Your Journey is waiting whenever you're ready to continue.</p>
    <p><a href="${journeyUrl}">Continue My Journey</a></p>
    <p>Welcome to AVAIA.</p>
  `.trim();
}

/** The /contact form's notification email — sent to
 *  CONTACT_NOTIFICATION_EMAIL (if configured) whenever someone submits the
 *  public form. The submission itself is always saved to
 *  contact_submissions regardless of whether this send succeeds. */
export function contactSubmissionEmailHtml({
  name,
  email,
  reasonLabel,
  message,
}: {
  name: string;
  email: string;
  reasonLabel: string;
  message: string;
}): string {
  return `
    <h2>New AVAIA contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `.trim();
}

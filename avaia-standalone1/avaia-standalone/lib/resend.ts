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

import "server-only";

/**
 * Server-only Resend sender. Calls the REST API directly with fetch rather
 * than pulling in the `resend` SDK.
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

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

export function experienceInquiryEmailHtml({
  name,
  email,
  phone,
  organizationName,
  groupTypeLabel,
  approxGroupSize,
  location,
  experienceLabel,
  requestDetails,
}: {
  name: string;
  email: string;
  phone: string | null;
  organizationName: string | null;
  groupTypeLabel: string;
  approxGroupSize: string | null;
  location: string | null;
  experienceLabel: string;
  requestDetails: string | null;
}): string {
  return `
    <h2>New AVAIA Experience inquiry (Agent 8)</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
    ${organizationName ? `<p><strong>Organization/Group:</strong> ${escapeHtml(organizationName)}</p>` : ""}
    <p><strong>Group type:</strong> ${escapeHtml(groupTypeLabel)}</p>
    ${approxGroupSize ? `<p><strong>Approximate group size:</strong> ${escapeHtml(approxGroupSize)}</p>` : ""}
    ${location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ""}
    <p><strong>Interested in:</strong> ${escapeHtml(experienceLabel)}</p>
    ${requestDetails ? `<p><strong>Details:</strong></p><p style="white-space:pre-wrap">${escapeHtml(requestDetails)}</p>` : ""}
  `.trim();
}

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

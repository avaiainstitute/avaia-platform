import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Automation audit finding #1.2: every caller of sendEmail already wraps
// it in its own try/catch and swallows failures (a genuinely consistent
// "never block the user" pattern) -- but every failure's only trace was a
// console.error line in Vercel's ephemeral logs. Recorded here once,
// centrally, since this is the one chokepoint every caller already goes
// through, rather than teaching each call site to log separately.
async function recordEmailSendFailure(context: string | undefined, error: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("email_send_failures").insert({ context: context ?? null, error });
  } catch {
    // Logging the failure must never itself throw -- the caller already
    // has the original error from sendEmail's own rejection.
  }
}

/**
 * Server-only Resend sender. Calls the REST API directly with fetch rather
 * than pulling in the `resend` SDK.
 */
export async function sendEmail({
  to,
  subject,
  html,
  context,
}: {
  to: string;
  subject: string;
  html: string;
  /** Short caller-supplied label (e.g. "host_onboarding_reminder",
   *  "contact_notification"), recorded only if this send fails, so a
   *  failure has a queryable trace beyond Vercel's own ephemeral logs.
   *  Optional -- omitting it just means a failure's trace has no label. */
  context?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await recordEmailSendFailure(context, "RESEND_API_KEY is not set in this deployment.");
    throw new Error("RESEND_API_KEY is not set in this deployment.");
  }
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
    await recordEmailSendFailure(context, `Resend send failed (${res.status}): ${detail}`);
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

/** Automation audit finding #4.5: the AVAIA /contact form saved and
 *  notified Dorian but never confirmed anything to the person who actually
 *  submitted it, unlike the matching Pink Shoelace form (lib/pink/emails.ts's
 *  pinkContactAcknowledgmentEmailHtml, the pattern this mirrors). */
export function contactAcknowledgmentEmailHtml({ name }: { name: string }): string {
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for reaching out to AVAIA. Your message has been received, and Dorian will
    follow up personally as soon as he can.</p>
    <p style="color:#888">— AVAIA</p>
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

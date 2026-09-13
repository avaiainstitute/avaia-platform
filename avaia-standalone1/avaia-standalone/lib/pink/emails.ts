import "server-only";
import { escapeHtml } from "@/lib/resend";

/** Every acknowledgment below is a fixed template with no model-generated
 *  content. Nothing here promises a price, a partnership term, a donation
 *  mechanism, or any commitment Pink Shoelace/AVAIA hasn't actually made --
 *  that's the whole point of keeping these as fixed strings rather than
 *  generating a reply per message. */

const SIGNOFF = `<p style="color:#888">— The Pink Shoelace Foundation</p>`;

export function pinkContactAcknowledgmentEmailHtml({ name }: { name: string }): string {
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for reaching out to The Pink Shoelace Foundation. Your message has been received, and Dorian will follow up personally as soon as he can.</p>
    ${SIGNOFF}
  `.trim();
}

export function pinkContactNotificationEmailHtml({
  name,
  email,
  category,
  message,
}: {
  name: string;
  email: string;
  category: string;
  message: string;
}): string {
  return `
    <h2>New Pink Shoelace contact form submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Category (auto-classified):</strong> ${escapeHtml(category)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `.trim();
}

export function pinkParticipationAcknowledgmentEmailHtml({
  name,
  interestType,
}: {
  name: string;
  interestType: string;
}): string {
  const INTEREST_LABEL: Record<string, string> = {
    wear_shoelace: "wearing a pink shoelace",
    walk_alongside: "walking alongside someone",
    honor_someone: "honoring someone",
    foundation_participation: "getting involved with the Foundation",
    other: "getting involved",
  };
  const label = INTEREST_LABEL[interestType] ?? "getting involved";
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thank you for your interest in ${escapeHtml(label)}. This has been received, and Dorian will follow up personally.</p>
    <p>As a reminder, the Foundation's programs are still being built -- nothing here is a confirmation of participation, only that your interest has been noted.</p>
    ${SIGNOFF}
  `.trim();
}

export function pinkParticipationNotificationEmailHtml({
  name,
  email,
  interestType,
  note,
  honoreeName,
}: {
  name: string;
  email: string;
  interestType: string;
  note: string | null;
  honoreeName: string | null;
}): string {
  return `
    <h2>New Pink Shoelace participation interest</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Interest type:</strong> ${escapeHtml(interestType)}</p>
    ${honoreeName ? `<p><strong>Honoring:</strong> ${escapeHtml(honoreeName)}</p>` : ""}
    ${note ? `<p><strong>Note:</strong></p><p style="white-space:pre-wrap">${escapeHtml(note)}</p>` : ""}
  `.trim();
}

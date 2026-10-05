import "server-only";
import { sendEmail } from "@/lib/resend";

// THE PINK SHOELACE FOUNDATION'S OWN EMAIL IDENTITY.
//
// Pink Shoelace Foundation and AVAIA are separate organizations (Founder directive,
// 2026-10-05), so a Foundation email must never go out as "AVAIA". Every Pink email is sent
// through this one function.
//
//   PINK_FROM_EMAIL      the Foundation's own verified address, e.g. hello@thepinkshoelace.org
//                        (or "The Pink Shoelace Foundation <hello@thepinkshoelace.org>")
//   PINK_RESEND_API_KEY  optional: the Foundation's own Resend account key
//
// Until the owner has verified the Foundation's own sending domain, PINK_FROM_EMAIL is unset
// and the display name is the Foundation's but the address is still on AVAIA's verified
// domain. That is NOT separate, and the Pink system check "pink_email_identity" says so
// plainly until it is fixed.

export const PINK_DISPLAY_NAME = "The Pink Shoelace Foundation";
const SHARED_FALLBACK_ADDRESS = "noreply@avaiainstitute.com";

type EnvLike = Record<string, string | undefined>;

/** The "From" header for every Foundation email. Never contains AVAIA's display name. */
export function pinkFromHeader(env: EnvLike = process.env): string {
  const configured = (env.PINK_FROM_EMAIL ?? "").trim();
  if (configured) return configured.includes("<") ? configured : `${PINK_DISPLAY_NAME} <${configured}>`;
  return `${PINK_DISPLAY_NAME} <${SHARED_FALLBACK_ADDRESS}>`;
}

/** True only when the Foundation sends from an address of its own, not AVAIA's domain. */
export function pinkEmailIdentityIsIndependent(env: EnvLike = process.env): boolean {
  const configured = (env.PINK_FROM_EMAIL ?? "").trim();
  return configured !== "" && !/avaiainstitute\.com/i.test(configured);
}

export async function sendPinkEmail({
  to,
  subject,
  html,
  context,
}: {
  to: string;
  subject: string;
  html: string;
  context: string;
}): Promise<void> {
  await sendEmail({
    to,
    subject,
    html,
    context: `pink_${context}`,
    from: pinkFromHeader(),
    apiKey: process.env.PINK_RESEND_API_KEY || undefined,
  });
}

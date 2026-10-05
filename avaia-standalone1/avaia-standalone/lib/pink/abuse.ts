import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Basic spam protection for the Foundation's two public intake endpoints. It does not decide
// who a "real" person is and invents no policy; it only stops obvious automated floods, because
// each accepted submission stores a record and sends an acknowledgment email to whatever address
// was typed in.
//
//   1. The form must come from the Foundation's own site (isAllowedPinkOrigin in cors.ts).
//   2. A hidden field a person never sees (`website`) must be empty. A bot that fills every
//      field trips it, and gets a normal-looking success so it learns nothing.
//   3. The same email address may submit only a few times an hour, and the whole endpoint only
//      so many times an hour.

export const PER_EMAIL_PER_HOUR = 3;
export const PER_ENDPOINT_PER_HOUR = 60;

/** The hidden spam-trap field. Any value at all means "not a person". */
export function honeypotTripped(body: unknown): boolean {
  const v = (body as { website?: unknown } | null)?.website;
  return typeof v === "string" && v.trim() !== "";
}

/** True when this submission should be refused as too frequent. */
export function overLimit(sameEmailLastHour: number, endpointLastHour: number): boolean {
  return sameEmailLastHour >= PER_EMAIL_PER_HOUR || endpointLastHour >= PER_ENDPOINT_PER_HOUR;
}

export async function isThrottled(
  table: "pink_contact_submissions" | "pink_participation_interest",
  email: string
): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: sameEmail }, { count: endpoint }] = await Promise.all([
    admin.from(table).select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since),
    admin.from(table).select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  return overLimit(sameEmail ?? 0, endpoint ?? 0);
}

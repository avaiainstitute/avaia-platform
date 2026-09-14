import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agents 3 (Partnership) and 4 (Donor & Sponsor), Automation Blueprint
// Phase 4. Both functions open a trackable downstream record the moment a
// Pink Shoelace contact form message classifies into the matching category
// (see lib/pink/classify.ts) -- previously pink_partnerships and
// pink_donor_sponsor_records could only ever be created by hand. Neither
// function invents a pricing tier, a sponsorship level, or a payment: both
// only ever create a plain tracking/follow-up record, matching what
// docs/PINK_INTEGRATION.md already documents about the current, deliberate
// scope of these two tables.

const PARTNERSHIP_FOLLOWUP_DAYS = Number(process.env.PINK_PARTNERSHIP_FOLLOWUP_DAYS ?? 3);
const DONOR_FOLLOWUP_DAYS = Number(process.env.PINK_DONOR_FOLLOWUP_DAYS ?? 5);

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

type ContactFields = { name: string; email: string; message: string };

/** Agent 3. organization_name has no dedicated field on the general contact
 *  form, so the submitter's own name is used as a placeholder pending
 *  Dorian's review/correction -- never invented. Idempotent via
 *  pink_partnerships_source_contact_unique (0071): a retried/duplicate
 *  contact submission never opens a second partnership record for the same
 *  inquiry. Best-effort -- called from a try/catch at the call site, the
 *  same posture as this route's own acknowledgment/notification emails, so
 *  a failure here never blocks the submitter's own successful response. */
export async function ensurePartnershipFromContact(
  contactId: string,
  { name, email, message }: ContactFields
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("pink_partnerships").insert({
    organization_name: name,
    contact_name: name,
    contact_email: email,
    notes:
      `Auto-created from a Pink Shoelace contact form message classified as a partnership inquiry. ` +
      `Organization name not yet confirmed -- update once known.\n\nOriginal message:\n${message}`,
    dorian_action_needed: true,
    next_follow_up_at: daysFromNow(PARTNERSHIP_FOLLOWUP_DAYS),
    source_contact_id: contactId,
  });
  if (error && error.code !== "23505") {
    console.error("Pink Shoelace: failed to auto-create partnership record:", error);
  }
}

/** Agent 4. donor_type (individual / business_sponsor / organization /
 *  other) is left unset -- nothing in a free-text message reliably
 *  determines that real distinction, so it's left for Dorian to set on
 *  review rather than guessed. This is a tracking/follow-up record only:
 *  no payment processor is referenced or invented here. Idempotent via
 *  pink_donor_sponsor_records_source_contact_unique (0071). */
export async function ensureDonorSponsorRecordFromContact(
  contactId: string,
  { name, email, message }: ContactFields
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("pink_donor_sponsor_records").insert({
    donor_name: name,
    contact_email: email,
    notes:
      `Auto-created from a Pink Shoelace contact form message classified as volunteer/donate interest. ` +
      `Donor type not yet confirmed -- update once known. This is a tracking record only; no payment has ` +
      `been made or requested.\n\nOriginal message:\n${message}`,
    dorian_action_needed: true,
    next_follow_up_at: daysFromNow(DONOR_FOLLOWUP_DAYS),
    source_contact_id: contactId,
  });
  if (error && error.code !== "23505") {
    console.error("Pink Shoelace: failed to auto-create donor/sponsor record:", error);
  }
}

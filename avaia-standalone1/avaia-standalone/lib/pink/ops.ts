import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestCheckProblems } from "@/lib/ops/system-checks";
import type { NeedsItem } from "@/lib/ops/needs-dorian-core";

// THE PINK SHOELACE FOUNDATION'S OWN "WHAT NEEDS ATTENTION".
//
// The Pink Shoelace Foundation is separate from AVAIA. Its operations are not
// part of AVAIA's What Needs Dorian, AVAIA's Founder Digest, or AVAIA's admin.
// They live here, and are shown at /pink-admin and emailed in the Pink daily
// summary (app/api/cron/pink-daily-summary). Same rule as AVAIA's: computed
// live from the underlying records, nothing stored, an item disappears when what
// it describes is resolved, and routine activity never appears.
//
// All of the Foundation's data is untouched: the pink_* tables hold every
// record exactly as before. Only where the operations are displayed changed.

const ONE_DAY_MS = 86_400_000;
const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY_MS);

export type PinkSnapshot = {
  generatedAt: string;
  /** Things only a person can do. */
  people: NeedsItem[];
  approvals: NeedsItem[];
  problems: NeedsItem[];
  /** New research finds awaiting a first look (visibility, not counted). */
  opportunities: NeedsItem[];
  /** Plain-language summary of the last 24 hours (for the daily email). */
  whatHappened: string[];
  totalNeeded: number;
};

export async function getPinkSnapshot(): Promise<PinkSnapshot> {
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();

  const [
    { data: contacts },
    { data: participation },
    { data: dueFollowUps },
    { data: duePartnerships },
    { data: flaggedPartnerships },
    { data: dueDonors },
    { data: flaggedDonors },
    { data: contentRows },
    { count: newPartnerships },
    { count: newDonors },
    { count: contactCount },
    { count: participationCount },
    { data: newPartnershipNames },
    { data: newDonorNames },
    checkProblems,
  ] = await Promise.all([
    admin.from("pink_contact_submissions").select("name, category, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]).order("created_at", { ascending: true }),
    admin.from("pink_participation_interest").select("name, interest_type, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]).order("created_at", { ascending: true }),
    admin
      .from("founder_notes")
      .select("kind, title, person_name, organization_name, next_action")
      .eq("category", "pink_shoelace")
      .in("kind", ["follow_up", "meeting_note"])
      .eq("status", "open")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", day),
    admin.from("pink_partnerships").select("organization_name").lte("next_follow_up_at", nowIso).not("next_follow_up_at", "is", null),
    admin.from("pink_partnerships").select("organization_name").eq("dorian_action_needed", true),
    admin.from("pink_donor_sponsor_records").select("donor_name").lte("next_follow_up_at", nowIso).not("next_follow_up_at", "is", null),
    admin.from("pink_donor_sponsor_records").select("donor_name").eq("dorian_action_needed", true),
    admin.from("avaia_content_items").select("id, title, related_to").eq("status", "waiting_for_approval"),
    admin.from("pink_partnership_prospects").select("id", { count: "exact", head: true }).eq("status", "new").in("relevance", ["pink", "both"]),
    admin.from("pink_donor_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("pink_contact_submissions").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("pink_participation_interest").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("pink_partnership_prospects").select("organization_name").gte("created_at", since).in("relevance", ["pink", "both"]),
    admin.from("pink_donor_prospects").select("organization_name").gte("created_at", since),
    getLatestCheckProblems().catch(() => []),
  ]);

  const people: NeedsItem[] = [];
  const push = (list: NeedsItem[], prefix: string, text: string, href?: string) => list.push({ key: `${prefix}:${list.length}`, text, href });

  for (const c of contacts ?? []) push(people, "contact", `Pink Shoelace contact form -- ${c.name} (${c.category}), ${daysAgo(c.created_at)} day(s) ago.`, "/pink-admin/inquiries");
  for (const p of participation ?? []) push(people, "participation", `Pink Shoelace participation interest -- ${p.name} (${p.interest_type}), ${daysAgo(p.created_at)} day(s) ago.`, "/pink-admin/inquiries");
  for (const f of dueFollowUps ?? []) {
    const who = [f.person_name, f.organization_name].filter(Boolean).join(", ");
    push(people, "followup", `${f.kind === "meeting_note" ? "Follow-up from a meeting" : "Follow-up"} due${who ? ` -- ${who}` : ""}: ${f.next_action || f.title}.`, "/pink-admin/notes");
  }
  for (const p of duePartnerships ?? []) push(people, "partnership-due", `Partnership follow-up due: ${p.organization_name}.`);
  for (const p of flaggedPartnerships ?? []) push(people, "partnership-flag", `Partnership flagged for action: ${p.organization_name}.`);
  for (const d of dueDonors ?? []) push(people, "donor-due", `Donor/sponsor follow-up due: ${d.donor_name}.`);
  for (const d of flaggedDonors ?? []) push(people, "donor-flag", `Donor/sponsor lead flagged for action: ${d.donor_name}.`);

  const approvals: NeedsItem[] = [];
  const pinkContent = (contentRows ?? []).filter((c) => String(c.related_to ?? "").startsWith("pink_"));
  if (pinkContent.length > 0) push(approvals, "content", `${pinkContent.length} Pink Shoelace content item(s) waiting for your approval.`, "/pink-admin/content");

  const problems: NeedsItem[] = [];
  for (const p of checkProblems) {
    if (!p.checkKey.startsWith("pink_")) continue;
    push(problems, "check", `${p.label}${p.detail ? ` -- ${p.detail}` : ""}.`);
  }

  const opportunities: NeedsItem[] = [];
  if ((newPartnerships ?? 0) > 0) push(opportunities, "opp", `${newPartnerships} new partnership prospect(s) awaiting first review.`, "/pink-admin/opportunities");
  if ((newDonors ?? 0) > 0) push(opportunities, "opp", `${newDonors} new donor/sponsor prospect(s) awaiting first review.`, "/pink-admin/opportunities");

  const whatHappened: string[] = [
    `${contactCount ?? 0} new Pink Shoelace contact form submission(s) in the last 24 hours.`,
    `${participationCount ?? 0} new Pink Shoelace participation-interest submission(s) in the last 24 hours.`,
    ...(newPartnershipNames ?? []).map((p) => `New partnership prospect: ${p.organization_name}.`),
    ...(newDonorNames ?? []).map((d) => `New donor/sponsor prospect: ${d.organization_name}.`),
  ];

  return {
    generatedAt: nowIso,
    people,
    approvals,
    problems,
    opportunities,
    whatHappened,
    totalNeeded: people.length + approvals.length + problems.length,
  };
}

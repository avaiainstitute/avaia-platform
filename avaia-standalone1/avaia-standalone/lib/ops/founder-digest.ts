import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getGuideOperationsSnapshot } from "@/lib/ops/guide-operations";
import { getPinkAvaiaConnections } from "@/lib/ops/pink-avaia-connection";
import { founderDigestEmailHtml } from "@/lib/ops/emails";

const ONE_DAY_MS = 86_400_000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY_MS);
}

export async function buildFounderDigestEmail(): Promise<{ subject: string; html: string }> {
  const admin = createAdminClient();
  const since = isoDaysAgo(1);
  const now = new Date().toISOString();

  const [
    { count: avaiaContactCount },
    { data: needsDorianAvaiaContacts },
    { count: pinkContactCount },
    { data: needsDorianPinkContacts },
    { count: pinkParticipationCount },
    { data: needsDorianPinkParticipation },
    { data: duePartnerships },
    { data: actionNeededPartnerships },
    { data: dueDonorRecords },
    { data: actionNeededDonorRecords },
    hostOnboarding,
    guideOperations,
    pinkAvaiaConnections,
    { count: experienceInquiryCount },
    { data: needsDorianExperienceInquiries },
    { data: newPartnershipProspects },
    { count: reviewPartnershipProspectCount },
    { data: newDonorProspects },
    { count: reviewDonorProspectCount },
    { data: newProgramProspects },
    { count: reviewProgramProspectCount },
    { count: draftContentCount },
    { count: approvedContentCount },
  ] = await Promise.all([
    admin.from("contact_submissions").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("contact_submissions")
      .select("name, reason, created_at")
      .eq("needs_dorian", true)
      .in("status", ["new", "acknowledged"])
      .order("created_at", { ascending: true }),
    admin.from("pink_contact_submissions").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("pink_contact_submissions")
      .select("name, category, created_at")
      .eq("needs_dorian", true)
      .in("status", ["new", "acknowledged"])
      .order("created_at", { ascending: true }),
    admin
      .from("pink_participation_interest")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    admin
      .from("pink_participation_interest")
      .select("name, interest_type, created_at")
      .eq("needs_dorian", true)
      .in("status", ["new", "acknowledged"])
      .order("created_at", { ascending: true }),
    admin
      .from("pink_partnerships")
      .select("organization_name, next_follow_up_at")
      .lte("next_follow_up_at", now)
      .not("next_follow_up_at", "is", null)
      .order("next_follow_up_at", { ascending: true }),
    admin.from("pink_partnerships").select("organization_name").eq("dorian_action_needed", true),
    admin
      .from("pink_donor_sponsor_records")
      .select("donor_name, next_follow_up_at")
      .lte("next_follow_up_at", now)
      .not("next_follow_up_at", "is", null)
      .order("next_follow_up_at", { ascending: true }),
    admin.from("pink_donor_sponsor_records").select("donor_name").eq("dorian_action_needed", true),
    getHostOnboardingSnapshot(),
    getGuideOperationsSnapshot(),
    getPinkAvaiaConnections(since),
    // Agent 8 inbound (Programs & Experiences)
    admin.from("avaia_experience_inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("avaia_experience_inquiries")
      .select("name, experience_interest, created_at")
      .eq("needs_dorian", true)
      .in("status", ["new", "acknowledged"])
      .order("created_at", { ascending: true }),
    // Agents 3/4/8 outbound research -- newly discovered since last digest,
    // and running totals still awaiting a first review.
    admin
      .from("pink_partnership_prospects")
      .select("organization_name")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    admin.from("pink_partnership_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin
      .from("pink_donor_prospects")
      .select("organization_name")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    admin.from("pink_donor_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin
      .from("avaia_experience_prospects")
      .select("organization_name")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    admin.from("avaia_experience_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    // Agent 9 (Communications & Content)
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);

  const whatHappened: string[] = [
    `${avaiaContactCount ?? 0} new AVAIA contact form submission(s) in the last 24 hours.`,
    `${pinkContactCount ?? 0} new Pink Shoelace contact form submission(s) in the last 24 hours.`,
    `${pinkParticipationCount ?? 0} new Pink Shoelace participation-interest submission(s) in the last 24 hours.`,
    `${experienceInquiryCount ?? 0} new AVAIA Programs & Experiences inquiry/inquiries in the last 24 hours.`,
  ];

  const automatic = [
    "Every new AVAIA and Pink Shoelace form submission is saved and acknowledged automatically.",
    "Routine submissions (no flagged review needed) receive an automatic reply -- nothing further is required.",
    "Hosts who stall mid-conversation receive a gentle, rate-limited reminder automatically (no more than one per stage per reminder window).",
    "Pink Shoelace contact messages that read as a partnership or volunteer/donate inquiry automatically open a trackable follow-up record.",
    "Partnership, donor/sponsor, and Programs & Experiences prospects are researched automatically once a week -- never contacted automatically, only discovered and described for your review.",
  ];

  const opportunities: string[] = [];
  for (const p of newPartnershipProspects ?? []) {
    opportunities.push(`New partnership prospect: ${p.organization_name}.`);
  }
  for (const d of newDonorProspects ?? []) {
    opportunities.push(`New donor/sponsor prospect: ${d.organization_name}.`);
  }
  for (const e of newProgramProspects ?? []) {
    opportunities.push(`New Programs & Experiences prospect: ${e.organization_name}.`);
  }

  const waiting: string[] = [];
  for (const p of duePartnerships ?? []) {
    waiting.push(`Partnership follow-up due: ${p.organization_name}.`);
  }
  for (const p of actionNeededPartnerships ?? []) {
    waiting.push(`Partnership flagged for action: ${p.organization_name}.`);
  }
  for (const d of dueDonorRecords ?? []) {
    waiting.push(`Donor/sponsor follow-up due: ${d.donor_name}.`);
  }
  for (const d of actionNeededDonorRecords ?? []) {
    waiting.push(`Donor/sponsor lead flagged for action: ${d.donor_name}.`);
  }
  if (hostOnboarding.stalledHosts.length) {
    waiting.push(
      `${hostOnboarding.stalledHosts.length} Host(s) currently stalled mid-conversation (reminders are being sent automatically; listed here for visibility only).`
    );
  }
  for (const item of guideOperations.waitingItems) {
    waiting.push(
      item.type === "paid_awaiting_decision"
        ? `A certification payment has been waiting ${item.sinceDays} day(s) for a decision.`
        : `A guide candidacy (status: ${item.status}) has had no recorded activity in ${item.sinceDays} day(s).`
    );
  }
  for (const c of pinkAvaiaConnections) {
    waiting.push(
      `Pink Shoelace <> AVAIA connection: ${c.pinkName} (${c.pinkEmail}) appears in both Pink Shoelace and AVAIA -- for visibility only, no automatic action taken.`
    );
  }
  if ((reviewPartnershipProspectCount ?? 0) > 0) {
    waiting.push(`Partnership prospect(s) awaiting your first review: ${reviewPartnershipProspectCount}.`);
  }
  if ((reviewDonorProspectCount ?? 0) > 0) {
    waiting.push(`Donor/sponsor prospect(s) awaiting your first review: ${reviewDonorProspectCount}.`);
  }
  if ((reviewProgramProspectCount ?? 0) > 0) {
    waiting.push(`Programs & Experiences prospect(s) awaiting your first review: ${reviewProgramProspectCount}.`);
  }
  if ((draftContentCount ?? 0) > 0) {
    waiting.push(`${draftContentCount} content item(s) in draft awaiting your review/approval.`);
  }
  if ((approvedContentCount ?? 0) > 0) {
    waiting.push(`${approvedContentCount} approved content item(s) ready to schedule or publish.`);
  }

  const needsDorian: string[] = [];
  for (const c of needsDorianAvaiaContacts ?? []) {
    needsDorian.push(`AVAIA contact form -- ${c.name} (${c.reason}), ${daysAgo(c.created_at)} day(s) ago.`);
  }
  for (const c of needsDorianPinkContacts ?? []) {
    needsDorian.push(`Pink Shoelace contact form -- ${c.name} (${c.category}), ${daysAgo(c.created_at)} day(s) ago.`);
  }
  for (const p of needsDorianPinkParticipation ?? []) {
    needsDorian.push(
      `Pink Shoelace participation interest -- ${p.name} (${p.interest_type}), ${daysAgo(p.created_at)} day(s) ago.`
    );
  }
  for (const e of needsDorianExperienceInquiries ?? []) {
    needsDorian.push(
      `AVAIA Programs & Experiences inquiry -- ${e.name} (${e.experience_interest}), ${daysAgo(e.created_at)} day(s) ago.`
    );
  }

  const priorityCandidates = [
    ...needsDorian,
    ...waiting.filter(
      (w) => w.startsWith("Partnership") || w.startsWith("Donor/sponsor") || w.startsWith("Programs & Experiences")
    ),
  ];
  const priorities = priorityCandidates.slice(0, 5);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = founderDigestEmailHtml({
    dateLabel,
    whatHappened,
    automatic,
    waiting,
    needsDorian,
    priorities,
    opportunities,
  });
  const subject =
    needsDorian.length > 0
      ? `AVAIA + Pink Shoelace daily summary -- ${needsDorian.length} item(s) need you`
      : "AVAIA + Pink Shoelace daily summary";

  return { subject, html };
}

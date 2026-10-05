import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getNeedsDorian, snapshotToDigestSections } from "@/lib/ops/needs-dorian";
import { founderDigestEmailHtml } from "@/lib/ops/emails";
import type { CapabilityEvidence } from "@/lib/ops/needs-dorian-core";

// The daily email. It is one VIEW of the single Needs-Dorian source
// (lib/ops/needs-dorian.ts), the same source /admin/today renders live, so
// the two can never disagree about what needs Dorian. This file decides
// nothing about that: it only adds the digest's own "what happened in the last
// day" summary and formats the email.

const ONE_DAY_MS = 86_400_000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

export async function buildFounderDigestEmail(): Promise<{ subject: string; html: string; capabilityEvidence: CapabilityEvidence[] }> {
  const admin = createAdminClient();
  const since = isoDaysAgo(1);

  const [
    { count: avaiaContactCount },
    { count: experienceInquiryCount },
    { data: newProgramProspects },
    { data: newSpeakingOpportunities },
    hostOnboarding,
    snapshot,
  ] = await Promise.all([
    admin.from("contact_submissions").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("avaia_experience_inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("avaia_experience_prospects").select("organization_name").gte("created_at", since).order("created_at", { ascending: true }),
    admin.from("avaia_speaking_opportunities").select("organization_name").gte("created_at", since).order("created_at", { ascending: true }),
    getHostOnboardingSnapshot(),
    getNeedsDorian(),
  ]);

  // The digest's own informational section: what came in during the last day.
  const whatHappened: string[] = [
    `${avaiaContactCount ?? 0} new AVAIA contact form submission(s) in the last 24 hours.`,
    `${experienceInquiryCount ?? 0} new AVAIA Programs & Experiences inquiry/inquiries in the last 24 hours.`,
    ...(newProgramProspects ?? []).map((e) => `New Programs & Experiences prospect: ${e.organization_name}.`),
    ...(newSpeakingOpportunities ?? []).map((s) => `New speaking/conference opportunity: ${s.organization_name}.`),
    `Journey funnel right now -- new: ${hostOnboarding.stateCounts.new_host}, mid-IAP: ${hostOnboarding.stateCounts.iap_started}, at the membership gate: ${hostOnboarding.stateCounts.cat_eligible}, mid-CAT: ${hostOnboarding.stateCounts.cat_started}, mid-InnerCompass: ${hostOnboarding.stateCounts.innercompass_started}, completed: ${hostOnboarding.stateCounts.journey_completed}.`,
  ];

  const sections = snapshotToDigestSections(snapshot);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = founderDigestEmailHtml({
    dateLabel,
    whatHappened,
    automatic: sections.automatic,
    waiting: sections.waiting,
    needsDorian: sections.needsDorian,
    priorities: sections.priorities,
    opportunities: sections.opportunities,
  });
  const subject =
    sections.needsDorian.length > 0
      ? `AVAIA daily summary -- ${sections.needsDorian.length} item(s) need you`
      : "AVAIA daily summary";

  return { subject, html, capabilityEvidence: snapshot.capabilityEvidence ?? [] };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getGuideOperationsSnapshot } from "@/lib/ops/guide-operations";
import { getCronHealthIssues } from "@/lib/ops/cron-runs";
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
    hostOnboarding,
    guideOperations,
    { count: crisisEventCount },
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
    getHostOnboardingSnapshot(),
    getGuideOperationsSnapshot(),
    // Count only -- never host_id, conversation_id, or any message content.
    // This is oversight visibility that a safety net fired somewhere, not a
    // list of who to look up; see crisis_events' own migration comment.
    admin.from("crisis_events").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);

  // Checked directly rather than via Promise.all above: if the cron_runs
  // table read itself throws (e.g. mid-migration), that shouldn't take down
  // the rest of the digest -- an empty issue list just means this section
  // stays silent for today rather than the whole email failing to send.
  const cronHealthIssues = await getCronHealthIssues().catch(() => [] as string[]);

  const whatHappened: string[] = [
    `${avaiaContactCount ?? 0} new AVAIA contact form submission(s) in the last 24 hours.`,
    `${pinkContactCount ?? 0} new Pink Shoelace contact form submission(s) in the last 24 hours.`,
    `${pinkParticipationCount ?? 0} new Pink Shoelace participation-interest submission(s) in the last 24 hours.`,
    `Journey funnel right now -- new: ${hostOnboarding.stateCounts.new_host}, mid-IAP: ${hostOnboarding.stateCounts.iap_started}, at the membership gate: ${hostOnboarding.stateCounts.cat_eligible}, mid-CAT: ${hostOnboarding.stateCounts.cat_started}, mid-InnerCompass: ${hostOnboarding.stateCounts.innercompass_started}, completed: ${hostOnboarding.stateCounts.journey_completed}.`,
  ];

  const automatic = [
    "Every new AVAIA and Pink Shoelace form submission is saved and acknowledged automatically.",
    "Routine submissions (no flagged review needed) receive an automatic reply -- nothing further is required.",
    "Hosts who stall mid-conversation receive a gentle, rate-limited reminder automatically (no more than one per stage per reminder window).",
  ];

  const waiting: string[] = [];
  for (const p of duePartnerships ?? []) {
    waiting.push(`Partnership follow-up due: ${p.organization_name}.`);
  }
  for (const p of actionNeededPartnerships ?? []) {
    waiting.push(`Partnership flagged for action: ${p.organization_name}.`);
  }
  if (hostOnboarding.stalledHosts.length) {
    waiting.push(
      `${hostOnboarding.stalledHosts.length} Host(s) currently stalled mid-conversation (reminders are being sent automatically; listed here for visibility only).`
    );
  }
  for (const item of guideOperations.waitingItems) {
    if (item.type === "paid_awaiting_decision") {
      waiting.push(`A certification payment has been waiting ${item.sinceDays} day(s) for a decision.`);
    } else if (item.type === "candidacy_stalled") {
      waiting.push(`A guide candidacy (status: ${item.status}) has had no recorded activity in ${item.sinceDays} day(s).`);
    } else if (item.type === "certified_awaiting_grant") {
      waiting.push(`A 'certified' decision has been waiting ${item.sinceDays} day(s) for the certification grant.`);
    } else {
      waiting.push(`An active certification has been waiting ${item.sinceDays} day(s) for Toolkit authorization.`);
    }
  }

  const needsDorian: string[] = [...cronHealthIssues];
  if ((crisisEventCount ?? 0) > 0) {
    needsDorian.push(
      `${crisisEventCount} crisis-safety flag(s) fired across AVAIA's conversation surfaces in the last 24 hours (count only -- no content or identity is included here; AVAIA's own in-conversation safety response already ran automatically).`
    );
  }
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

  const priorityCandidates = [...needsDorian, ...waiting.filter((w) => w.startsWith("Partnership"))];
  const priorities = priorityCandidates.slice(0, 5);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = founderDigestEmailHtml({ dateLabel, whatHappened, automatic, waiting, needsDorian, priorities });
  const subject =
    needsDorian.length > 0
      ? `AVAIA + Pink Shoelace daily summary -- ${needsDorian.length} item(s) need you`
      : "AVAIA + Pink Shoelace daily summary";

  return { subject, html };
}

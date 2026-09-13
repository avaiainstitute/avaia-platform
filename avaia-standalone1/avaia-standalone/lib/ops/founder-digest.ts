import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getGuideOperationsSnapshot } from "@/lib/ops/guide-operations";
import { founderDigestEmailHtml } from "@/lib/ops/emails";

// Agent 10 -- Founder / Operations digest. This is the one place that reads
// across AVAIA + Pink Shoelace and produces Dorian's single daily operating
// view, per the build instruction's own framing: "Agent 10 gives Dorian one
// operating view," not ten disconnected bots each pinging him separately.
//
// Hard boundary, enforced by what this file selects: every query below
// selects only status/category/timestamp columns (or, for the flagged
// "needs Dorian" lists, a name/reason already meant to be seen by a human
// reviewing that inbox) -- never contact_submissions.message,
// pink_contact_submissions.message, messages.content, or
// guide_candidate_history.body. "Do not dump database information on him"
// and "do not include private Host conversation content" are satisfied at
// the query level, not just by trimming the output afterward.

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
  ]);

  // --- WHAT HAPPENED ------------------------------------------------------
  const whatHappened: string[] = [
    `${avaiaContactCount ?? 0} new AVAIA contact form submission(s) in the last 24 hours.`,
    `${pinkContactCount ?? 0} new Pink Shoelace contact form submission(s) in the last 24 hours.`,
    `${pinkParticipationCount ?? 0} new Pink Shoelace participation-interest submission(s) in the last 24 hours.`,
  ];

  // --- WHAT IS BEING HANDLED AUTOMATICALLY ---------------------------------
  const automatic = [
    "Every new AVAIA and Pink Shoelace form submission is saved and acknowledged automatically.",
    "Routine submissions (no flagged review needed) receive an automatic reply -- nothing further is required.",
    "Hosts who stall mid-conversation receive a gentle, rate-limited reminder automatically (no more than one per stage per reminder window).",
  ];

  // --- WHAT IS WAITING ------------------------------------------------------
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
    waiting.push(
      item.type === "paid_awaiting_decision"
        ? `A certification payment has been waiting ${item.sinceDays} day(s) for a decision.`
        : `A guide candidacy (status: ${item.status}) has had no recorded activity in ${item.sinceDays} day(s).`
    );
  }

  // --- WHAT NEEDS DORIAN ----------------------------------------------------
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

  // --- TODAY'S PRIORITIES ---------------------------------------------------
  // Deterministic: the oldest flagged "needs Dorian" items first (they've
  // waited longest), then overdue partnership follow-ups, capped at 5.
  // Never a model-generated suggestion -- every line here is an existing
  // flagged record, just ordered by how long it's been waiting.
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

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getGuideOperationsSnapshot } from "@/lib/ops/guide-operations";
import { getPinkAvaiaConnections } from "@/lib/ops/pink-avaia-connection";
import { getLatestCheckProblems } from "@/lib/ops/system-checks";
import { getCronHealthIssues } from "@/lib/ops/cron-runs";
import { getUnresolvedReconciliationFindings } from "@/lib/ops/entitlement-reconciliation";
import { getGuardianConsentSnapshot } from "@/lib/ops/guardian-consent-reminders";
import { getStalledFamilyInvites } from "@/lib/ops/family-invite-reminders";
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
    { count: approvalPendingContentCount },
    { count: approvedContentCount },
    { data: newSpeakingOpportunities },
    { count: reviewSpeakingOpportunityCount },
    { data: dueFounderFollowUps },
    { data: readyForReviewCandidates },
    checkProblems,
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
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "waiting_for_approval"),
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "approved"),
    // Round 4: Opportunity Finder's "speaking" vertical.
    admin
      .from("avaia_speaking_opportunities")
      .select("organization_name")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    admin.from("avaia_speaking_opportunities").select("id", { count: "exact", head: true }).eq("status", "new"),
    // Round 4: Follow-up Memory / After-Meeting Capture -- due today or
    // overdue, still open. Round 4: Decision Keeper/Idea Catcher entries
    // never appear here by design (see lib/ops/founder-notes.ts's own
    // comment) -- only follow-ups and meeting-note next actions are
    // time-bound waiting items.
    admin
      .from("founder_notes")
      .select("kind, title, person_name, organization_name, follow_up_date, next_action")
      .in("kind", ["follow_up", "meeting_note"])
      .eq("status", "open")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", now.slice(0, 10))
      .order("follow_up_date", { ascending: true }),
    // Round 4: Guide Certification Operations extension -- candidates
    // Dorian himself has marked ready for his certification review.
    admin
      .from("guide_candidates")
      .select("host_id, ready_for_review_notes")
      .eq("ready_for_review", true)
      .in("status", ["admitted", "in_training", "development_required", "paused", "hold"]),
    // Round 4: Website/Journey/Shared Room Watchers + Testing/QC -- only
    // the most recent run's non-pass results, never the full pass list.
    getLatestCheckProblems(),
    // Automation audit finding #2/#3.6: count only, never host_id,
    // conversation_id, or any message content. This is oversight
    // visibility that a safety net fired somewhere, not a list of who to
    // look up; see crisis_events' own migration comment. Distinct from
    // the Watchers above -- those check that routes/pages/tables are
    // reachable, this checks that AVAIA's own in-conversation safety net
    // actually fired somewhere in the last 24h.
    admin.from("crisis_events").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);

  // Audit finding #1: did the three scheduled crons themselves (this one
  // included) actually run and complete successfully recently? Distinct
  // from the Watchers' cronAuthGateCheck (which only proves the route
  // exists and rejects unauthenticated calls) -- this is the actual
  // execution outcome of each scheduled run. Checked directly rather than
  // via Promise.all above: if the cron_runs table read itself throws, that
  // shouldn't take down the rest of the digest.
  const cronHealthIssues = await getCronHealthIssues().catch(() => [] as string[]);

  // Audit finding #2.4: Stripe subscription state that still doesn't match
  // the local entitlement record after reconciliation ran -- either an
  // uncorrected "should have access" case (never auto-granted, see that
  // module's own comment for why) or a correction that itself failed.
  // Never re-runs Stripe calls here; reads the most recent cron's own
  // recorded result.
  const reconciliationFindings = await getUnresolvedReconciliationFindings().catch(() => []);

  // Audit finding #5.3: guardian consents stalled long enough that a
  // reminder already went to the owning Guide -- surfaced to Dorian only
  // when they've been stalled long enough to matter at the founder level
  // too (double the normal stall window), not on the same schedule as the
  // Guide's own first notice.
  const guardianConsentWaiting = await getGuardianConsentSnapshot()
    .then((s) => s.waitingItems.filter((i) => i.sinceDays >= 8))
    .catch(() => []);

  // Audit finding #2.5: visibility only, same posture as the stalled-Host
  // count below -- reminders are already being sent automatically to the
  // invitee, Dorian doesn't need to act on this, just see it exists.
  const stalledFamilyInvites = await getStalledFamilyInvites()
    .then((r) => r.stalled)
    .catch(() => []);

  // Audit finding #1.2: count only -- every caller already logs its own
  // context via console.error too, this is just the one place that count
  // becomes visible without needing to go looking in Vercel's own logs.
  const { count: emailFailureCount } = await admin
    .from("email_send_failures")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .then(
      (r) => r,
      () => ({ count: 0 })
    );

  const whatHappened: string[] = [
    `${avaiaContactCount ?? 0} new AVAIA contact form submission(s) in the last 24 hours.`,
    `${pinkContactCount ?? 0} new Pink Shoelace contact form submission(s) in the last 24 hours.`,
    `${pinkParticipationCount ?? 0} new Pink Shoelace participation-interest submission(s) in the last 24 hours.`,
    `${experienceInquiryCount ?? 0} new AVAIA Programs & Experiences inquiry/inquiries in the last 24 hours.`,
    `Journey funnel right now -- new: ${hostOnboarding.stateCounts.new_host}, mid-IAP: ${hostOnboarding.stateCounts.iap_started}, at the membership gate: ${hostOnboarding.stateCounts.cat_eligible}, mid-CAT: ${hostOnboarding.stateCounts.cat_started}, mid-InnerCompass: ${hostOnboarding.stateCounts.innercompass_started}, completed: ${hostOnboarding.stateCounts.journey_completed}.`,
  ];

  const automatic = [
    "Every new AVAIA and Pink Shoelace form submission is saved and acknowledged automatically.",
    "Routine submissions (no flagged review needed) receive an automatic reply -- nothing further is required.",
    "Hosts who stall mid-conversation receive a gentle, rate-limited reminder automatically (no more than one per stage per reminder window).",
    "Pink Shoelace contact messages that read as a partnership or volunteer/donate inquiry automatically open a trackable follow-up record.",
    "Partnership, donor/sponsor, Programs & Experiences, and speaking/conference prospects are researched automatically once a week -- never contacted automatically, only discovered and described for your review.",
    "Website, Journey, and Shared Room operational health is checked automatically on a schedule -- you only hear about it here when something needs your attention.",
    "Stripe subscription state is checked against AVAIA's own access records daily -- an entitlement that should have ended is revoked automatically; anything else is only ever surfaced, never auto-granted.",
    "Guardian consents that stall are reminded to the owning Guide automatically, rate-limited so nobody is chased more than once every two weeks.",
    "An unaccepted Family Membership invitation is reminded directly to the invited person automatically, rate-limited the same way.",
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
  for (const s of newSpeakingOpportunities ?? []) {
    opportunities.push(`New speaking/conference opportunity: ${s.organization_name}.`);
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
  if (stalledFamilyInvites.length) {
    const extraSeatCount = stalledFamilyInvites.filter((i) => i.isExtraSeat).length;
    waiting.push(
      `${stalledFamilyInvites.length} Family Membership invite(s) still unaccepted past the normal window${extraSeatCount ? ` (${extraSeatCount} billed as extra seat(s))` : ""} -- reminders are being sent automatically to the invitee; listed here for visibility only.`
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
  if ((reviewSpeakingOpportunityCount ?? 0) > 0) {
    waiting.push(`Speaking/conference opportunity(ies) awaiting your first review: ${reviewSpeakingOpportunityCount}.`);
  }
  if ((approvalPendingContentCount ?? 0) > 0) {
    waiting.push(`${approvalPendingContentCount} content item(s) waiting for your approval.`);
  }
  if ((approvedContentCount ?? 0) > 0) {
    waiting.push(`${approvedContentCount} approved content item(s) ready to schedule or publish.`);
  }

  const needsDorian: string[] = [...cronHealthIssues];
  for (const f of reconciliationFindings) {
    needsDorian.push(
      f.type === "stripe_active_no_local_entitlement"
        ? `Stripe shows an active ${f.tier} subscription with no matching AVAIA entitlement (Host ${f.hostId}, Stripe subscription ${f.stripeSubscriptionId}) -- not auto-granted, review and grant manually if this is legitimate.`
        : `Reconciliation tried to revoke a ${f.tier} entitlement whose Stripe subscription ended, but the correction itself failed (Host ${f.hostId}${f.correctionError ? `: ${f.correctionError}` : ""}) -- needs a manual look.`
    );
  }
  for (const item of guardianConsentWaiting) {
    needsDorian.push(
      item.type === "consent_pending"
        ? `Guardian consent for ${item.participantName} has been pending ${item.sinceDays} day(s) -- the Guide has already been reminded.`
        : `Youth assent for ${item.participantName} hasn't been confirmed in ${item.sinceDays} day(s) -- the Guide has already been reminded.`
    );
  }
  if ((crisisEventCount ?? 0) > 0) {
    needsDorian.push(
      `${crisisEventCount} crisis-safety flag(s) fired across AVAIA's conversation surfaces in the last 24 hours (count only -- no content or identity is included here; AVAIA's own in-conversation safety response already ran automatically).`
    );
  }
  if ((emailFailureCount ?? 0) > 0) {
    needsDorian.push(
      `${emailFailureCount} email send(s) failed in the last 24 hours -- check the email_send_failures table for which ones.`
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
  for (const e of needsDorianExperienceInquiries ?? []) {
    needsDorian.push(
      `AVAIA Programs & Experiences inquiry -- ${e.name} (${e.experience_interest}), ${daysAgo(e.created_at)} day(s) ago.`
    );
  }
  // Round 4: Follow-up Memory / After-Meeting Capture, due today or overdue.
  for (const f of dueFounderFollowUps ?? []) {
    const who = [f.person_name, f.organization_name].filter(Boolean).join(", ");
    needsDorian.push(
      `${f.kind === "meeting_note" ? "Follow-up from a meeting" : "Follow-up"} due${who ? ` -- ${who}` : ""}: ${f.next_action || f.title}.`
    );
  }
  // Round 4: Guide Certification Operations -- candidates Dorian marked
  // ready for his own review. Never a system-generated readiness claim.
  for (const c of readyForReviewCandidates ?? []) {
    needsDorian.push(
      `Guide candidate ready for certification review (Host ${c.host_id})${c.ready_for_review_notes ? ` -- ${c.ready_for_review_notes}` : "."}`
    );
  }
  // Round 4: Website/Journey/Shared Room Watchers + Testing/QC.
  for (const p of checkProblems) {
    needsDorian.push(`${p.label}${p.detail ? ` -- ${p.detail}` : ""} (${p.category.replace(/_/g, " ")}).`);
  }

  const priorityCandidates = [
    ...needsDorian,
    ...waiting.filter(
      (w) =>
        w.startsWith("Partnership") ||
        w.startsWith("Donor/sponsor") ||
        w.startsWith("Programs & Experiences") ||
        w.startsWith("Speaking")
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

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGuideOperationsSnapshot } from "@/lib/ops/guide-operations";
import { getLatestCheckProblems } from "@/lib/ops/system-checks";

// "What Needs Dorian?" (Round 4, Group 1, item 1) -- built as an extension
// of the existing Founder/Operations Agent (lib/ops/founder-digest.ts),
// not a new standalone agent, per Dorian's own instruction to determine
// that first. This module is the shared source both the Founder Digest
// email and the new /admin/today live view read from, so the two never
// drift apart or say different things.
//
// Deliberately narrow: only things that genuinely need DORIAN are counted
// here. Anything already being handled automatically (routine form
// acknowledgment, weekly research, reminder emails) never appears -- see
// each bucket's own query below for exactly what qualifies.

export type CommandCenterBucket = { count: number; items: string[] };

export type CommandCenterSnapshot = {
  people: CommandCenterBucket; // calls/replies only Dorian can make
  decisions: CommandCenterBucket; // a decision only Dorian can make
  approvals: CommandCenterBucket; // something drafted/prepared, waiting on his go-ahead
  problems: CommandCenterBucket; // something a Watcher/QC check found broken
  opportunities: CommandCenterBucket; // new research finds awaiting his first look
  handledSummary: string[]; // what's running on its own, for reassurance only
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const admin = createAdminClient();
  const day = today();

  const [
    { data: avaiaContacts },
    { data: pinkContacts },
    { data: pinkParticipation },
    { data: experienceInquiries },
    { data: dueFollowUps },
    guideOps,
    { data: readyCandidates },
    { count: draftContent },
    { count: newPartnerships },
    { count: newDonors },
    { count: newPrograms },
    { count: newSpeaking },
    problems,
  ] = await Promise.all([
    admin.from("contact_submissions").select("name, reason, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]),
    admin.from("pink_contact_submissions").select("name, category, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]),
    admin.from("pink_participation_interest").select("name, interest_type, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]),
    admin.from("avaia_experience_inquiries").select("name, experience_interest, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]),
    admin
      .from("founder_notes")
      .select("kind, title, person_name, organization_name, follow_up_date, next_action")
      .in("kind", ["follow_up", "meeting_note"])
      .eq("status", "open")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", day)
      .order("follow_up_date", { ascending: true }),
    getGuideOperationsSnapshot(),
    admin
      .from("guide_candidates")
      .select("id, host_id, ready_for_review_notes")
      .eq("ready_for_review", true)
      .in("status", ["admitted", "in_training", "development_required", "paused", "hold"]),
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin.from("pink_partnership_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("pink_donor_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("avaia_experience_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("avaia_speaking_opportunities").select("id", { count: "exact", head: true }).eq("status", "new"),
    getLatestCheckProblems(),
  ]);

  const peopleItems: string[] = [];
  for (const c of avaiaContacts ?? []) peopleItems.push(`AVAIA contact -- ${c.name} (${c.reason}).`);
  for (const c of pinkContacts ?? []) peopleItems.push(`Pink Shoelace contact -- ${c.name} (${c.category}).`);
  for (const p of pinkParticipation ?? []) peopleItems.push(`Pink Shoelace participation interest -- ${p.name} (${p.interest_type}).`);
  for (const e of experienceInquiries ?? []) peopleItems.push(`Programs & Experiences inquiry -- ${e.name} (${e.experience_interest}).`);
  for (const f of dueFollowUps ?? []) {
    const who = [f.person_name, f.organization_name].filter(Boolean).join(", ");
    peopleItems.push(
      `${f.kind === "meeting_note" ? "Follow-up from a meeting" : "Follow-up"} due${who ? ` -- ${who}` : ""}: ${f.next_action || f.title}.`
    );
  }

  const decisionItems: string[] = [];
  for (const item of guideOps.waitingItems) {
    if (item.type === "paid_awaiting_decision") {
      decisionItems.push(`Guide certification decision awaiting -- payment received ${item.sinceDays} day(s) ago, no decision recorded yet (Host ${item.hostId}).`);
    }
  }
  for (const c of readyCandidates ?? []) {
    decisionItems.push(`Guide candidate marked ready for certification review (Host ${c.host_id})${c.ready_for_review_notes ? ` -- ${c.ready_for_review_notes}` : "."}`);
  }

  const approvalItems: string[] = [];
  if ((draftContent ?? 0) > 0) approvalItems.push(`${draftContent} content item(s) in draft awaiting your approval before they're scheduled.`);

  const problemItems = problems.map(
    (p) => `${p.label}${p.detail ? ` -- ${p.detail}` : ""} (${p.category.replace(/_/g, " ")}).`
  );

  const opportunityItems: string[] = [];
  if ((newPartnerships ?? 0) > 0) opportunityItems.push(`${newPartnerships} new partnership prospect(s) awaiting first review.`);
  if ((newDonors ?? 0) > 0) opportunityItems.push(`${newDonors} new donor/sponsor prospect(s) awaiting first review.`);
  if ((newPrograms ?? 0) > 0) opportunityItems.push(`${newPrograms} new Programs & Experiences prospect(s) awaiting first review.`);
  if ((newSpeaking ?? 0) > 0) opportunityItems.push(`${newSpeaking} new speaking/conference opportunity(ies) awaiting first review.`);

  const handledSummary = [
    "Every new AVAIA and Pink Shoelace form submission is saved and acknowledged automatically.",
    "Partnership, donor/sponsor, Programs & Experiences, and speaking/conference prospects are researched automatically -- never contacted automatically.",
    "Hosts who stall mid-conversation get a gentle, rate-limited reminder automatically.",
    "Website, Journey, and Shared Room operational health is checked automatically on a schedule.",
  ];

  return {
    people: { count: peopleItems.length, items: peopleItems },
    decisions: { count: decisionItems.length, items: decisionItems },
    approvals: { count: approvalItems.length, items: approvalItems },
    problems: { count: problemItems.length, items: problemItems },
    opportunities: { count: opportunityItems.length, items: opportunityItems },
    handledSummary,
  };
}

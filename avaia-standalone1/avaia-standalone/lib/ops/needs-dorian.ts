import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHostOnboardingSnapshot } from "@/lib/ops/host-onboarding";
import { getCertificationOpsSnapshot } from "@/lib/ops/guide-operations";
import { getAllCertificationOperationsRecords } from "@/lib/ops/certification-operations";
import type { CertificationOperationsRecord } from "@/lib/certification-operations";
import { getLatestCheckProblems } from "@/lib/ops/system-checks";
import { getCronHealthIssues } from "@/lib/ops/cron-runs";
import { getUnresolvedReconciliationFindings } from "@/lib/ops/entitlement-reconciliation";
import { getGuardianConsentSnapshot } from "@/lib/ops/guardian-consent-reminders";
import { getStalledFamilyInvites } from "@/lib/ops/family-invite-reminders";
import { evaluateCapabilities, mergeCapabilityItems } from "@/lib/ops/capabilities";


// The pure rules (what counts, where each item belongs, how the email reads it)
// live in needs-dorian-core.ts, which touches no database; this file only reads
// the live records and feeds them through those rules.
import {
  assembleSnapshot,
  classifyCertificationRecords,
  type NeedsDorianSnapshot,
  type NeedsItem,
} from "@/lib/ops/needs-dorian-core";
export * from "@/lib/ops/needs-dorian-core";

// ---------------------------------------------------------------------------
// The live snapshot
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 86_400_000;
const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY_MS);

/** Companion escalations that only a person can answer. A possible crisis is
 *  emailed immediately and counted under "watching"; "no confident match" is
 *  only logged. */
const ESCALATION_LABEL: Record<string, string> = {
  waiver_request: "asked to waive or skip a requirement",
  evaluation_dispute: "disputed a recorded evaluation",
  judgment_territory: "asked about a Boundary Gate or Practicum judgment",
};

export async function getNeedsDorian(): Promise<NeedsDorianSnapshot> {
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();

  const [
    { data: avaiaContacts },
    { data: experienceInquiries },
    { data: dueFollowUps },
    { count: approvalPendingContent },
    { count: approvedContent },
    { count: newPrograms },
    { count: newSpeaking },
    { count: crisisEventCount },
    { data: escalationRows },
    hostOnboarding,
    renewal,
    certRecords,
    checkProblems,
    cronIssues,
    reconciliation,
    guardianWaiting,
    stalledFamily,
    capabilityEvaluation,
  ] = await Promise.all([
    admin.from("contact_submissions").select("name, reason, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]).order("created_at", { ascending: true }),
    admin.from("avaia_experience_inquiries").select("name, experience_interest, created_at").eq("needs_dorian", true).in("status", ["new", "acknowledged"]).order("created_at", { ascending: true }),
    admin
      .from("founder_notes")
      .select("kind, title, person_name, organization_name, follow_up_date, next_action")
      .in("kind", ["follow_up", "meeting_note"])
      .eq("status", "open")
      .not("follow_up_date", "is", null)
      .lte("follow_up_date", day)
      .order("follow_up_date", { ascending: true }),
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "waiting_for_approval"),
    admin.from("avaia_content_items").select("id", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("avaia_experience_prospects").select("id", { count: "exact", head: true }).eq("status", "new"),
    admin.from("avaia_speaking_opportunities").select("id", { count: "exact", head: true }).eq("status", "new"),
    // Count only; never a host id, conversation id, or any content.
    admin.from("crisis_events").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("certification_companion_escalations")
      .select("id, candidate_id, category, note, created_at")
      .in("category", Object.keys(ESCALATION_LABEL))
      .is("resolved_at", null)
      .order("created_at", { ascending: true }),
    getHostOnboardingSnapshot().catch(() => null),
    getCertificationOpsSnapshot().catch(() => ({ needsDorian: [] as string[], waiting: [] as string[], lapsedLast24h: 0 })),
    getAllCertificationOperationsRecords().catch(() => [] as CertificationOperationsRecord[]),
    getLatestCheckProblems().catch(() => []),
    getCronHealthIssues().catch(() => [] as string[]),
    getUnresolvedReconciliationFindings().catch(() => []),
    getGuardianConsentSnapshot().then((s) => s.waitingItems.filter((i) => i.sinceDays >= 8)).catch(() => []),
    getStalledFamilyInvites().then((r) => r.stalled).catch(() => []),
    evaluateCapabilities(),
  ]);

  // Failed sends in the last day (count only).
  const { count: emailFailureCount } = await admin
    .from("email_send_failures")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .then(
      (r) => r,
      () => ({ count: 0 })
    );

  // Names for candidates (email, so the item is actionable without a lookup).
  const hostIds = new Set<string>();
  for (const r of certRecords) hostIds.add(r.hostId);
  const escalationCandidateIds = (escalationRows ?? []).map((e) => e.candidate_id as string);
  const { data: escalationCandidates } = escalationCandidateIds.length
    ? await admin.from("guide_candidates").select("id, host_id").in("id", escalationCandidateIds)
    : { data: [] as { id: string; host_id: string }[] };
  for (const c of escalationCandidates ?? []) hostIds.add(c.host_id);
  const emailByHost = new Map<string, string>();
  await Promise.all(
    Array.from(hostIds).map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        if (data?.user?.email) emailByHost.set(id, data.user.email);
      } catch {
        // fall back to the id below
      }
    })
  );
  const label = (hostId: string) => emailByHost.get(hostId) ?? `Host ${hostId}`;

  // -------------------------------------------------------------- people
  const people: NeedsItem[] = [];
  const add = (list: NeedsItem[], prefix: string, text: string, extra: Partial<NeedsItem> = {}) =>
    list.push({ key: `${prefix}:${list.length}`, text, ...extra });

  for (const c of avaiaContacts ?? []) add(people, "contact", `AVAIA contact form -- ${c.name} (${c.reason}), ${daysAgo(c.created_at)} day(s) ago.`, { href: "/admin/inquiries" });
  for (const e of experienceInquiries ?? []) add(people, "experience", `AVAIA Programs & Experiences inquiry -- ${e.name} (${e.experience_interest}), ${daysAgo(e.created_at)} day(s) ago.`, { href: "/admin/programs" });
  for (const f of dueFollowUps ?? []) {
    const who = [f.person_name, f.organization_name].filter(Boolean).join(", ");
    add(people, "followup", `${f.kind === "meeting_note" ? "Follow-up from a meeting" : "Follow-up"} due${who ? ` -- ${who}` : ""}: ${f.next_action || f.title}.`, { href: "/admin/notes" });
  }
  for (const item of guardianWaiting) {
    add(
      people,
      "guardian",
      item.type === "consent_pending"
        ? `Guardian consent for ${item.participantName} has been pending ${item.sinceDays} day(s) -- the Guide has already been reminded.`
        : `Youth assent for ${item.participantName} hasn't been confirmed in ${item.sinceDays} day(s) -- the Guide has already been reminded.`
    );
  }
  const hostByCandidate = new Map<string, string>((escalationCandidates ?? []).map((c): [string, string] => [c.id as string, c.host_id as string]));
  for (const e of escalationRows ?? []) {
    const who = label(hostByCandidate.get(e.candidate_id as string) ?? "");
    people.push({
      key: `escalation:${e.id}`,
      text: `${who} ${ESCALATION_LABEL[e.category as string]} in the Certification Companion (${daysAgo(e.created_at as string)} day(s) ago). The Companion did not answer it; it needs a person.`,
      href: `/admin/guide-candidates/${e.candidate_id}`,
      detail: e.note ? `Their message (first 500 characters): ${e.note}` : undefined,
      resolve: { kind: "companion_escalation", id: e.id as string },
    });
  }

  // ----------------------------------------------------------- decisions
  const cert = classifyCertificationRecords(certRecords, label);
  const decisions: NeedsItem[] = [
    ...cert.decisions,
    ...renewal.needsDorian.map((text, i) => ({ key: `renewal:${i}`, text, href: "/admin/guide-certifications" })),
  ];

  // ----------------------------------------------------------- approvals
  const approvals: NeedsItem[] = [];
  if ((approvalPendingContent ?? 0) > 0) add(approvals, "content", `${approvalPendingContent} content item(s) waiting for your approval.`, { href: "/admin/content" });

  // ------------------------------------------------------------ problems
  const problems: NeedsItem[] = [];
  for (const text of cronIssues) add(problems, "cron", text, { href: "/admin/system-checks" });
  for (const f of reconciliation) {
    add(
      problems,
      "reconcile",
      f.type === "stripe_active_no_local_entitlement"
        ? `Stripe shows an active ${f.tier} subscription with no matching AVAIA entitlement (Host ${f.hostId}, Stripe subscription ${f.stripeSubscriptionId}) -- not auto-granted, review and grant manually if this is legitimate.`
        : `Reconciliation tried to revoke a ${f.tier} entitlement whose Stripe subscription ended, but the correction itself failed (Host ${f.hostId}${f.correctionError ? `: ${f.correctionError}` : ""}) -- needs a manual look.`,
      { href: "/admin/entitlements" }
    );
  }
  if ((emailFailureCount ?? 0) > 0) add(problems, "email", `${emailFailureCount} email send(s) failed in the last 24 hours -- check the email_send_failures table for which ones.`);
  for (const p of checkProblems) {
    // Scheduled-job findings are listed above from the same source (live), not twice.
    if (p.checkKey.startsWith("schedule_")) continue;
    // Foundation checks (recorded before the separation) are not AVAIA's; the Foundation runs its own.
    if (p.checkKey.startsWith("pink_")) continue;
    // "Overall launch readiness" is only a summary of the other checks (it reads
    // "needs attention" whenever any one of them does), never a separate problem.
    if (p.category === "launch_readiness") continue;
    add(problems, "check", `${p.label}${p.detail ? ` -- ${p.detail}` : ""} (${p.category.replace(/_/g, " ")}).`, { href: "/admin/system-checks" });
  }
  problems.push(...cert.problems);

  // --------------------------------------------------------- opportunities
  const opportunities: NeedsItem[] = [];
  if ((newPrograms ?? 0) > 0) add(opportunities, "opp", `${newPrograms} new Programs & Experiences prospect(s) awaiting first review.`, { href: "/admin/opportunities" });
  if ((newSpeaking ?? 0) > 0) add(opportunities, "opp", `${newSpeaking} new speaking/conference opportunity(ies) awaiting first review.`, { href: "/admin/opportunities" });

  // -------------------------------------------------------------- watching
  const watching: NeedsItem[] = [];
  if (hostOnboarding && hostOnboarding.stalledHosts.length) {
    add(watching, "hosts", `${hostOnboarding.stalledHosts.length} Host(s) currently stalled mid-conversation (reminders are being sent automatically; listed here for visibility only).`);
  }
  if (stalledFamily.length) {
    const extra = stalledFamily.filter((i) => i.isExtraSeat).length;
    add(watching, "family", `${stalledFamily.length} Family Membership invite(s) still unaccepted past the normal window${extra ? ` (${extra} billed as extra seat(s))` : ""} -- reminders are being sent automatically to the invitee; listed here for visibility only.`);
  }
  if ((crisisEventCount ?? 0) > 0) {
    add(watching, "crisis", `${crisisEventCount} crisis-safety flag(s) fired across AVAIA's conversation surfaces in the last 24 hours (count only -- no content or identity is included here; AVAIA's own in-conversation safety response already ran automatically).`);
  }
  if ((approvedContent ?? 0) > 0) add(watching, "content-approved", `${approvedContent} approved content item(s) ready to schedule or publish.`);
  watching.push(...renewal.waiting.map((text, i) => ({ key: `renewal-waiting:${i}`, text, href: "/admin/guide-certifications" })));
  if (renewal.lapsedLast24h > 0) {
    add(watching, "lapsed", `${renewal.lapsedLast24h} Guide certification(s) became inactive in the last 24 hours (their 365-day period ended without renewal; records and authorization history are preserved).`, { href: "/admin/guide-certifications" });
  }
  watching.push(...cert.watching);

  // Operational capabilities (lib/ops/capabilities.ts): each contributes its own items
  // to the same buckets, and its evidence travels with the snapshot.
  const capability = mergeCapabilityItems(capabilityEvaluation.results);
  people.push(...capability.people);
  decisions.push(...capability.decisions);
  approvals.push(...capability.approvals);
  problems.push(...capability.problems);
  watching.push(...capability.watching);

  return assembleSnapshot({ people, decisions, approvals, problems, opportunities, watching, capabilityEvidence: capabilityEvaluation.evidence });
}

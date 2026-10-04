import "server-only";
import {
  ADMISSION_AMOUNT_CENTS,
  candidacyAccessMismatches,
  chargeIdempotencyKey,
  classifyApplications,
  mayAttemptCharge,
  shouldHoldCandidacyAccess,
  validateApplication,
  type ApplicationRecord,
} from "@/lib/certification-admissions";
import {
  REQUIRED_EVIDENCE_TYPES,
  buildCertificationOperationsRecords,
  type CertificationOperationsRecord,
  type EvidenceType,
} from "@/lib/certification-operations";
import {
  GATE_ITEM_KEYS,
  PRACTICUM_ROW_KEYS,
  labMayBeComplete,
  practiceProgress,
  tallyGate,
  tallyPracticum,
  type GateItemKey,
  type GateItemResult,
  type PracticumRating,
  type PracticumRowKey,
} from "@/lib/certification-evaluation";
import { GATE_ITEM_REFERENCE, PRACTICUM_ROW_REFERENCE } from "@/lib/certification-evaluator-reference";
import { getAllCurriculumItems, getPracticeLabByKey } from "@/lib/certification-content";
import { LAB12_KEY, buildHostPracticePrompt, hostCardFor, mayStartPractice, practiceOptions } from "@/lib/certification-practice";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR GUIDE CERTIFICATION (Move 6). Simulated records only: nothing is
// read from or written to the database and no real person is involved. They run
// the very same rules production runs, so if a future change quietly breaks one
// of these promises the next scheduled System Check reports it:
//
//   * the front door: no fee before a human admits; the charge happens once, only
//     after admission; a failed charge never revokes admission; a denied
//     applicant is never charged; denial handling is surfaced, not invented;
//   * two gates: admission makes a Candidate, never a Certified Guide;
//   * candidacy access follows candidacy and leaves a membership untouched;
//   * the path order and the seven required steps;
//   * human evaluations are only added up, never scored by the system or the AI;
//   * the AI Host plays from the Host Card only, and evaluator material is out of
//     reach of every candidate-visible surface.
//
// Keys use the pipeline_ prefix so they appear with the other pipeline proofs.

type Case = { name: string; ok: boolean };

function result(key: string, label: string, passDetail: string, cases: Case[]): CheckResult {
  const failed = cases.filter((c) => !c.ok).map((c) => c.name);
  return failed.length === 0
    ? { category: "quality", checkKey: key, label, status: "pass", detail: passDetail }
    : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
}

function attempt(key: string, label: string, run: () => CheckResult): CheckResult {
  try {
    return run();
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// The front door
// ---------------------------------------------------------------------------

function admissionsCheck(): CheckResult {
  const label = "Certification admissions behave as designed";
  return attempt("pipeline_certification_admissions", label, () => {
    const cases: Case[] = [];
    const now = Date.now();
    const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
    const rec = (over: Partial<ApplicationRecord>): ApplicationRecord => ({
      id: `a-${Math.random().toString(36).slice(2, 8)}`,
      hostId: "h",
      status: "ready_for_review",
      chargeStatus: "not_charged",
      chargeFailure: null,
      denialHandled: false,
      submittedAt: iso(1),
      paymentMethodSavedAt: iso(1),
      decidedAt: null,
      updatedAt: iso(1),
      previouslyNotAdmitted: false,
      ...over,
    });
    const who = (id: string) => `person ${id}`;
    const run = (rs: ApplicationRecord[]) => classifyApplications(rs, who, now);

    // The amount is the standard certification payment, in cents.
    cases.push({ name: "the admission amount is not the standard $1,495", ok: ADMISSION_AMOUNT_CENTS === 149_500 });

    // The application asks for the Prospectus fields and nothing else.
    const good = { fullName: "A B", contact: "a@b.c", whyInterested: "x", workContext: "y", howUseAvaia: "z", pathway: "core_certification", pathwayNote: "", orientationAgreed: true };
    cases.push({ name: "a complete application was refused", ok: validateApplication(good).ok });
    cases.push({ name: "an application without agreeing to orientation was accepted", ok: !validateApplication({ ...good, orientationAgreed: false }).ok });
    cases.push({ name: "an application with a missing answer was accepted", ok: !validateApplication({ ...good, whyInterested: "  " }).ok });
    cases.push({ name: "an application with an unknown pathway was accepted", ok: !validateApplication({ ...good, pathway: "free_membership" }).ok });

    // A human decision is due once, and only once a payment method is saved.
    const review = run([rec({})]);
    cases.push({ name: "an application ready for review was not exactly one decision", ok: review.decisions.length === 1 && review.problems.length === 0 });
    cases.push({ name: "the review item did not say admission is not certification", ok: /not a Certified Guide/.test(review.decisions[0]?.text ?? "") });
    cases.push({ name: "the review item did not say nothing is charged until admission", ok: /Nothing is charged until you admit/.test(review.decisions[0]?.text ?? "") });
    const noCard = run([rec({ status: "pending_payment_method", paymentMethodSavedAt: null, submittedAt: iso(2) })]);
    cases.push({ name: "an application with no saved payment method was a decision for Dorian", ok: noCard.decisions.length === 0 && noCard.problems.length === 0 });
    const oldNoCard = run([rec({ status: "pending_payment_method", paymentMethodSavedAt: null, submittedAt: iso(10) })]);
    cases.push({ name: "an application stuck before its card step was a task instead of visibility", ok: oldNoCard.watching.length === 1 && oldNoCard.decisions.length === 0 });

    // Charging: only after admission, never twice.
    cases.push({ name: "a charge was allowed before admission", ok: !mayAttemptCharge("ready_for_review", "not_charged") && !mayAttemptCharge("pending_payment_method", "not_charged") });
    cases.push({ name: "a charge was allowed for someone not admitted", ok: !mayAttemptCharge("not_admitted", "not_charged") && !mayAttemptCharge("not_admitted", "not_applicable") });
    cases.push({ name: "an admitted, uncharged application could not be charged", ok: mayAttemptCharge("admitted", "not_charged") });
    cases.push({ name: "a failed charge could not be retried", ok: mayAttemptCharge("admitted", "failed") });
    cases.push({ name: "a completed charge could be charged again", ok: !mayAttemptCharge("admitted", "charged") });
    cases.push({ name: "an in-flight charge could be started a second time", ok: !mayAttemptCharge("admitted", "charging") });
    cases.push({ name: "a retry reused the previous attempt's idempotency key", ok: chargeIdempotencyKey("x", 1) !== chargeIdempotencyKey("x", 2) && chargeIdempotencyKey("x", 1) === chargeIdempotencyKey("x", 1) });

    // A failed charge never revokes admission: it is a problem to retry, and the
    // application stays admitted.
    const failed = run([rec({ status: "admitted", chargeStatus: "failed", chargeFailure: "card declined", decidedAt: iso(1) })]);
    cases.push({ name: "a failed charge was not exactly one problem", ok: failed.problems.length === 1 && failed.decisions.length === 0 });
    cases.push({ name: "the failed-charge item did not say the admission stands", ok: /admission stands/.test(failed.problems[0]?.text ?? "") });
    const paid = run([rec({ status: "admitted", chargeStatus: "charged", decidedAt: iso(1) })]);
    cases.push({ name: "a paid, admitted application produced items", ok: !(paid.decisions.length || paid.problems.length || paid.policy.length || paid.watching.length) });
    const stuck = run([rec({ status: "admitted", chargeStatus: "charging", updatedAt: new Date(now - 3 * 3_600_000).toISOString() })]);
    cases.push({ name: "a charge attempt that never finished was not a problem", ok: stuck.problems.length === 1 });
    const inFlight = run([rec({ status: "admitted", chargeStatus: "charging", updatedAt: new Date(now - 60_000).toISOString() })]);
    cases.push({ name: "a charge attempt in progress for a minute was a problem", ok: inFlight.problems.length === 0 });

    // A denied applicant: surfaced until handled, never invented.
    const denied = run([rec({ status: "not_admitted", chargeStatus: "not_applicable", decidedAt: iso(1) })]);
    cases.push({ name: "denial handling was not surfaced as undecided", ok: denied.policy.length === 1 && /not yet decided/.test(denied.policy[0]?.text ?? "") });
    const deniedHandled = run([rec({ status: "not_admitted", chargeStatus: "not_applicable", denialHandled: true })]);
    cases.push({ name: "a handled denial still produced an item", ok: !(deniedHandled.policy.length || deniedHandled.decisions.length || deniedHandled.problems.length) });

    const all = [...review.decisions, ...failed.problems, ...denied.policy];
    cases.push({ name: "items were not unique", ok: new Set(all.map((i) => i.key)).size === all.length });
    cases.push({ name: "an item has no place to act", ok: all.every((i) => !!i.href) });

    // Candidacy access follows candidacy; a membership is left alone.
    cases.push({ name: "an admitted candidate was not given access", ok: shouldHoldCandidacyAccess("admitted", false) && shouldHoldCandidacyAccess("in_training", false) && shouldHoldCandidacyAccess("development_required", false) });
    cases.push({ name: "access stayed open for a paused, closed or certified candidate", ok: !shouldHoldCandidacyAccess("paused", false) && !shouldHoldCandidacyAccess("hold", false) && !shouldHoldCandidacyAccess("withdrawn", false) && !shouldHoldCandidacyAccess("not_certified", false) && !shouldHoldCandidacyAccess("in_training", true) });
    const noAccess = candidacyAccessMismatches({ candidates: [{ host_id: "c1", status: "admitted" }], certifiedHostIds: new Set(), activeEntitlements: [] });
    cases.push({ name: "a candidate with no access was not found", ok: noAccess.length === 1 && noAccess[0].kind === "missing" });
    const member = candidacyAccessMismatches({ candidates: [{ host_id: "c2", status: "admitted" }], certifiedHostIds: new Set(), activeEntitlements: [{ host_id: "c2", source: "individual" }] });
    cases.push({ name: "a candidate who already had a membership was flagged or would have it replaced", ok: member.length === 0 });
    const stale = candidacyAccessMismatches({ candidates: [{ host_id: "c3", status: "withdrawn" }], certifiedHostIds: new Set(), activeEntitlements: [{ host_id: "c3", source: "candidacy" }] });
    cases.push({ name: "candidacy access that outlived the candidacy was not found", ok: stale.length === 1 && stale[0].kind === "stale" });
    const memberNotStale = candidacyAccessMismatches({ candidates: [{ host_id: "c4", status: "withdrawn" }], certifiedHostIds: new Set(), activeEntitlements: [{ host_id: "c4", source: "individual" }] });
    cases.push({ name: "a membership was treated as stale candidacy access", ok: memberNotStale.length === 0 });
    const certified = candidacyAccessMismatches({ candidates: [{ host_id: "c5", status: "in_training" }], certifiedHostIds: new Set(["c5"]), activeEntitlements: [{ host_id: "c5", source: "candidacy" }] });
    cases.push({ name: "candidacy access survived certification", ok: certified.length === 1 && certified[0].kind === "stale" });

    return result(
      "pipeline_certification_admissions",
      label,
      "Simulated applications confirm: nothing is charged before a person admits; a charge is allowed only for an admitted application and never twice; a failed charge is one problem to retry and never revokes admission; a denied applicant is never charged and denial handling is surfaced as undecided, not invented; admission is always described as not certification; candidacy access is granted to a candidate, ends with candidacy or certification, and never touches a membership.",
      cases
    );
  });
}

// ---------------------------------------------------------------------------
// The path
// ---------------------------------------------------------------------------

function pathCheck(): CheckResult {
  const label = "The certification path behaves as designed";
  return attempt("pipeline_certification_path", label, () => {
    const cases: Case[] = [];
    const now = Date.now();
    const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
    const evidence = (types: readonly EvidenceType[], rating: "competent" | "development_required" = "competent") =>
      types.map((t) => ({ candidate_id: "c", evidence_type: t, rating, recorded_by: null as string | null, recorded_at: iso(1) }));
    const build = (types: readonly EvidenceType[], extra: { decided?: boolean } = {}): CertificationOperationsRecord =>
      buildCertificationOperationsRecords({
        candidates: [{ id: "c", host_id: "h", status: "in_training", admitted_at: iso(2), ready_for_review: false, ready_for_review_notes: null }],
        evidenceRows: evidence(types),
        decisions: extra.decided ? [{ host_id: "h", decision: "development_required", decision_date: iso(0) }] : [],
        certifications: [],
        platformAuth: [],
        profiles: [],
        progressRows: [],
        curriculumCounts: { lessonsTotal: 83, labsTotal: 15 },
        historyLastActivity: new Map<string, string>(),
        now,
      })[0];

    const pre: EvidenceType[] = ["candidate_agreement", "foundations_knowledge_check", "host_seat_experience", "table_building_exercise"];

    cases.push({ name: "the required steps are not exactly the seven approved", ok: REQUIRED_EVIDENCE_TYPES.length === 7 && ["candidate_agreement", "foundations_knowledge_check", "host_seat_experience", "table_building_exercise", "boundary_gate", "practice_facilitation", "observed_practicum"].every((t) => (REQUIRED_EVIDENCE_TYPES as readonly string[]).includes(t)) });
    cases.push({ name: "toolkit assembly is still a certification requirement", ok: !(REQUIRED_EVIDENCE_TYPES as readonly string[]).includes("toolkit_experience_assembly") });

    // Order: Classroom -> Host experience -> Gate -> Practice -> Practicum -> decision.
    cases.push({ name: "a new candidate was not waiting on the agreement", ok: build([]).derivedState === "agreement_pending" });
    cases.push({ name: "a candidate with only the agreement was not in the classroom stage", ok: build(["candidate_agreement"]).derivedState === "training_active" });
    cases.push({ name: "the Host-seat experience was not required before the Gate", ok: build(["candidate_agreement", "foundations_knowledge_check", "table_building_exercise"]).derivedState === "training_active" });
    cases.push({ name: "the Table-building exercise was not required before the Gate", ok: build(["candidate_agreement", "foundations_knowledge_check", "host_seat_experience"]).derivedState === "training_active" });
    cases.push({ name: "a candidate with every pre-Gate step was not eligible for the Gate", ok: build(pre).derivedState === "boundary_gate_eligible" });
    cases.push({ name: "a recorded Gate pass did not open practice", ok: build([...pre, "boundary_gate"]).derivedState === "practice_eligible" });
    cases.push({ name: "the Practicum opened before practice was complete", ok: build([...pre, "boundary_gate", "observed_practicum"]).derivedState === "practice_eligible" });
    cases.push({ name: "completed practice did not open the Practicum", ok: build([...pre, "boundary_gate", "practice_facilitation"]).derivedState === "practicum_eligible" });
    const full = build([...REQUIRED_EVIDENCE_TYPES]);
    cases.push({ name: "all seven steps did not reach the human decision", ok: full.derivedState === "ready_for_human_review" && full.humanActionRequired });
    cases.push({ name: "the portfolio read as ready without a competent Practicum", ok: build([...pre, "boundary_gate", "practice_facilitation"]).derivedState !== "ready_for_human_review" });
    cases.push({ name: "old evidence types alone completed the portfolio", ok: build(["candidate_agreement", "foundations_knowledge_check", "judgment_scenarios", "table_building_exercise", "recognition_assessment", "conversation_review", "practice_facilitation", "toolkit_experience_assembly", "boundary_gate", "observed_practicum", "guides_record_sample", "reflection_debrief"]).derivedState !== "ready_for_human_review" });
    const decided = build([...REQUIRED_EVIDENCE_TYPES], { decided: true });
    cases.push({ name: "a recorded decision still showed as awaiting a decision", ok: decided.derivedState !== "ready_for_human_review" });
    // Admission alone never reads as certification.
    cases.push({ name: "an admitted candidate read as certified or ready", ok: !["ready_for_human_review", "decision_recorded", "guide_handoff_complete", "permission_activation_pending"].includes(build(["candidate_agreement"]).derivedState) });

    // Human evaluations are only added up.
    const gate = (over: Partial<Record<GateItemKey, GateItemResult>> = {}) => {
      const items: Partial<Record<GateItemKey, GateItemResult>> = {};
      for (const k of GATE_ITEM_KEYS) items[k] = "met";
      return { ...items, ...over };
    };
    cases.push({ name: "the Gate does not have ten items", ok: GATE_ITEM_KEYS.length === 10 });
    cases.push({ name: "ten met items did not pass the Gate", ok: tallyGate(gate()).allMet });
    cases.push({ name: "one item not met passed the Gate", ok: !tallyGate(gate({ consent: "not_met" })).allMet });
    cases.push({ name: "safety not met passed or was partially scored", ok: !tallyGate(gate({ safety: "not_met" })).allMet && tallyGate(gate({ safety: "not_met" })).notMet.join() === "safety" });
    cases.push({ name: "an unanswered Gate item counted as complete", ok: !tallyGate({ ownership: "met" }).complete });
    const practicum = (over: Partial<Record<PracticumRowKey, PracticumRating>> = {}) => {
      const rows: Partial<Record<PracticumRowKey, PracticumRating>> = {};
      for (const k of PRACTICUM_ROW_KEYS) rows[k] = "meets";
      return { ...rows, ...over };
    };
    cases.push({ name: "the Practicum does not have eleven rows", ok: PRACTICUM_ROW_KEYS.length === 11 });
    cases.push({ name: "Meets on all rows did not pass the Practicum", ok: tallyPracticum(practicum()).allMeets });
    cases.push({ name: "a Developing row passed the Practicum", ok: !tallyPracticum(practicum({ cat: "developing" })).allMeets });
    cases.push({ name: "a Not Yet row passed the Practicum", ok: !tallyPracticum(practicum({ iap: "not_yet" })).allMeets });
    cases.push({ name: "a lab was completable without the full feedback response", ok: !labMayBeComplete({ receive: true, understand: true, adjust: true }, false) });
    cases.push({ name: "a lab was completable with a retry still required", ok: !labMayBeComplete({ receive: true, understand: true, adjust: true, try_again: true }, true) });
    cases.push({ name: "a lab with the full feedback response and no retry was not completable", ok: labMayBeComplete({ receive: true, understand: true, adjust: true, try_again: true }, false) });
    const labKeys = Array.from({ length: 15 }, (_, i) => `lab-${i + 1}`);
    const doneLabs = new Map(labKeys.map((k) => [k, { lab_complete: true }]));
    cases.push({ name: "fifteen complete labs did not complete practice", ok: practiceProgress(doneLabs, labKeys).allComplete });
    const fourteen = new Map(doneLabs);
    fourteen.delete("lab-9");
    cases.push({ name: "fourteen complete labs completed practice", ok: !practiceProgress(fourteen, labKeys).allComplete && practiceProgress(fourteen, labKeys).remaining.join() === "lab-9" });

    return result(
      "pipeline_certification_path",
      label,
      "Simulated candidates confirm: the seven required steps and their order (classroom, Host-seat experience and Table-building before the Gate; practice only after the Gate; the Practicum only after practice); toolkit assembly is not required; the system only adds up human ratings (ten Gate items all met, eleven Practicum rows all Meets, fifteen labs each completed with the full feedback response) and never reads admission as certification.",
      cases
    );
  });
}

// ---------------------------------------------------------------------------
// AI practice and evaluator isolation
// ---------------------------------------------------------------------------

function practiceCheck(): CheckResult {
  const label = "AI Host practice and evaluator material stay separate";
  return attempt("pipeline_certification_practice", label, () => {
    const cases: Case[] = [];

    // The candidate-visible content (everything the Companion and the AI Host can reach)
    // never contains evaluator-only wording.
    const candidateVisible = JSON.stringify(getAllCurriculumItems());
    const leaked: string[] = [];
    for (const g of GATE_ITEM_REFERENCE) {
      if (candidateVisible.includes(g.passStandard)) leaked.push(`Gate item ${g.number} pass standard`);
      if (candidateVisible.includes(g.retraining)) leaked.push(`Gate item ${g.number} retraining path`);
    }
    for (const r of PRACTICUM_ROW_REFERENCE) if (candidateVisible.includes(r.watchesFor)) leaked.push(`Practicum row ${r.competency}`);
    cases.push({ name: `evaluator-only wording reached candidate-visible content (${leaked.join(", ")})`, ok: leaked.length === 0 });
    cases.push({ name: "candidate-visible content carries a Witness or Facilitator card", ok: !/Witness Card|Facilitator Card|Evaluator Checks/.test(candidateVisible) });

    // Lab 12: the Host card is split by scenario; the Guide's "Candidate must" lines are not in it.
    const lab12 = getPracticeLabByKey(LAB12_KEY);
    const cardA = lab12 ? hostCardFor(lab12, "A") : null;
    const cardB = lab12 ? hostCardFor(lab12, "B") : null;
    const cardC = lab12 ? hostCardFor(lab12, "C") : null;
    cases.push({ name: "Lab 12 Scenario A card missing", ok: !!cardA && /Professional Authority/.test(cardA) });
    cases.push({ name: "Lab 12 Scenario A card contained another scenario or the candidate task", ok: !!cardA && !/Changed Consent|Immediate Safety|Candidate must/.test(cardA) });
    cases.push({ name: "Lab 12 Scenario B card was wrong", ok: !!cardB && /don't want to keep doing this/.test(cardB) && !/Professional Authority|Immediate Safety/.test(cardB) });
    cases.push({ name: "Lab 12 Scenario C card was wrong", ok: !!cardC && /emergency/.test(cardC) && !/Changed Consent|Professional Authority/.test(cardC) });
    cases.push({ name: "Lab 12 without a scenario produced a Host card", ok: !!lab12 && hostCardFor(lab12, null) === null });

    // The AI Host is told to be the Host, never the evaluator, and carries the crisis net.
    const prompt = cardA ? buildHostPracticePrompt({ labTitle: "Scope & Boundary", hostCard: cardA, guideMessagesSoFar: 1 }) : "";
    cases.push({ name: "the AI Host prompt allowed evaluating or scoring", ok: /NEVER say how the Guide is doing/.test(prompt) && /never rate, score/.test(prompt) });
    cases.push({ name: "the AI Host prompt lacked the crisis safety net", ok: /988/.test(prompt) && /911/.test(prompt) && /741741/.test(prompt) && /CRISIS SAFETY/.test(prompt) });
    cases.push({ name: "the AI Host prompt carried evaluator-only material", ok: GATE_ITEM_REFERENCE.every((g) => !prompt.includes(g.passStandard)) && !/Witness|Facilitator Card/.test(prompt) });

    // Availability: labs open after the Gate; Lab 12 A and B earlier; C and Lab 14 never early / never AI.
    const before = practiceOptions(false);
    const after = practiceOptions(true);
    cases.push({ name: "an ordinary lab was open before the Gate", ok: before.filter((o) => o.labKey !== LAB12_KEY).every((o) => !o.available) });
    cases.push({ name: "Lab 12 Scenarios A and B were not open early", ok: before.filter((o) => o.labKey === LAB12_KEY && (o.scenario === "A" || o.scenario === "B")).every((o) => o.available) });
    cases.push({ name: "Lab 12 Scenario C was open before the Gate", ok: before.filter((o) => o.labKey === LAB12_KEY && o.scenario === "C").every((o) => !o.available) });
    cases.push({ name: "practice was not open after the Gate", ok: after.length > 0 && after.every((o) => o.available) });
    cases.push({ name: "Lab 14 (no Host) had an AI practice", ok: !after.some((o) => o.labKey === "lab-14") });
    cases.push({ name: "starting a closed practice was allowed", ok: !mayStartPractice("lab-5", null, false).ok && mayStartPractice("lab-5", null, true).ok });

    return result(
      "pipeline_certification_practice",
      label,
      "Confirmed: no Gate pass standard, retraining path or Practicum evaluator wording appears in anything a candidate or the AI can read; the AI plays the Host from the Host card only, is told never to evaluate or score, carries the crisis instruction, and opens labs only after a recorded Gate (Lab 12 Scenarios A and B earlier, Lab 14 never).",
      cases
    );
  });
}

export function certificationPathChecks(): CheckResult[] {
  return [admissionsCheck(), pathCheck(), practiceCheck()];
}

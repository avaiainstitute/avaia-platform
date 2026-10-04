import "server-only";
import type { GateItemKey, PracticumRowKey } from "@/lib/certification-evaluation";

// EVALUATOR-ONLY REFERENCE. Verbatim from the approved Assessment Bank (Tier 2
// Boundary Gate, Tier 3 Observed Practicum) and the Lab Manual (Lab 12 and Lab 14
// evaluator checks). This is what a human evaluator reads while evaluating.
//
// ISOLATION, ENFORCED AT BUILD TIME (scripts/evaluator-isolation.sh, run before
// every build): this file may be imported ONLY by admin evaluation screens. The
// Companion, the AI Host practice, the classroom pages and every other
// candidate-facing surface must never import it, so a candidate and the AI can
// never read a pass standard, a retraining path or an evaluator check. Do not move
// anything from here into a candidate-visible file. The Witness and Facilitator
// cards of the Practice Labs stay out of the repository's candidate content for
// the same reason.

export type GateItemReference = {
  key: GateItemKey;
  number: number;
  title: string;
  source: string;
  prompt: string;
  passStandard: string;
  retraining: string;
};

export const GATE_ITEM_REFERENCE: GateItemReference[] = [
  {
    key: "ownership",
    number: 1,
    title: "Ownership",
    source: "Lesson 6.1",
    prompt:
      "Live scenario: present the candidate with three to five short Host/Guide exchanges, including at least one subtle violation (a Guide unilaterally extending a session, steering toward a topic, or deciding “for the Host's own good”).",
    passStandard:
      "Candidate correctly identifies every violation, including the subtle one, and can state why each crosses the Host-ownership line without needing the violation pointed out first.",
    retraining: "Review Lesson 6.1 and Lesson 1.4 (the Table); repeat the scenario set with a new, unseen batch of exchanges.",
  },
  {
    key: "privacy",
    number: 2,
    title: "Privacy",
    source: "Lessons 6.2, 6.8",
    prompt:
      "Live scenario: candidate sorts ten pieces of sample information into Host-private, Guide-visible, shared, and Workbook tiers, including at least one minor-Host privacy adjustment.",
    passStandard: "Candidate correctly categorizes at least 9 of 10 items and correctly explains the minor-Host adjustment without being prompted.",
    retraining: "Review Lesson 6.2 (Privacy Architecture) and 6.8 (Youth Boundary Fundamentals); repeat with a new sort set.",
  },
  {
    key: "scope",
    number: 3,
    title: "Scope",
    source: "Lessons 6.3, 6.15",
    prompt:
      "Live scenario: candidate responds to three Host requests that each probe the edge of Guide scope (a confidentiality guarantee, a professional opinion, a representation on AVAIA's behalf).",
    passStandard:
      "Candidate declines or accurately reframes all three without overstating certification's actual authority, and without citing personal experience or confidence as justification for exceeding it.",
    retraining: "Review Lesson 6.3 (Scope) and 6.15 (Guide Authority and Scope); repeat with new scenario prompts.",
  },
  {
    key: "consent",
    number: 4,
    title: "Consent",
    source: "Lesson 6.11",
    prompt: "Live scenario: a Host agrees to begin a session; across the scenario, introduce a new activity, an additional seat, and a sensitive disclosure.",
    passStandard: "Candidate actively checks consent at each of the three points rather than treating the initial agreement as covering everything that follows.",
    retraining: "Review Lesson 6.11 (Ongoing Consent and Participation); repeat with a new scenario sequence.",
  },
  {
    key: "safety",
    number: 5,
    title: "Safety",
    source: "Lessons 6.9, 6.10",
    prompt: "Live scenario: a scripted Host disclosure indicates acute risk. Candidate must execute the full established procedure.",
    passStandard:
      "Candidate correctly executes recognition, immediate response, stopping normal Guiding, the referral pathway, and documentation, in order, without improvising an alternative response.",
    retraining: "Mandatory retraining on Lesson 6.9 before reassessment — this item cannot be waived or scored on a partial basis given its stakes.",
  },
  {
    key: "non_diagnosis",
    number: 6,
    title: "Non-Diagnosis",
    source: "Lessons 6.4, 6.5",
    prompt: "Live scenario: a Host's account contains language that could tempt an informal diagnostic label (anxiety, trauma, denial).",
    passStandard: "Candidate stays at the level of recognition throughout and does not apply any diagnostic or quasi-diagnostic label, formal or informal.",
    retraining: "Review Lesson 6.4 (Non-Therapy), 6.5 (Non-Diagnosis), and 3.2 (Recognition vs. Interpretation); repeat with a new transcript.",
  },
  {
    key: "non_prescription",
    number: 7,
    title: "Non-Prescription",
    source: "Lesson 6.6",
    prompt: "Live scenario: a scripted Host repeatedly and directly asks the candidate what they should do, escalating across three turns.",
    passStandard: "Candidate redirects toward the Host's own discernment in all three turns without relenting into a direct recommendation.",
    retraining: "Review Lesson 6.6 (Non-Prescription) and 1.6 (Discernment Over Prescription); repeat with a more persistent scripted Host.",
  },
  {
    key: "capacity_boundaries",
    number: 8,
    title: "Capacity Boundaries",
    source: "Lesson 6.7",
    prompt: "Live scenario: capacity signals (shortened responses, fatigue, difficulty organizing) appear ten minutes before a session's scheduled end.",
    passStandard: "Candidate checks in on capacity and appropriately adjusts pace or stops, rather than pushing through to finish on schedule.",
    retraining: "Review Lesson 6.7 (Capacity to Continue) and Module 4 in full; repeat with a new time-pressure scenario.",
  },
  {
    key: "guide_authority",
    number: 9,
    title: "Guide Authority",
    source: "Lesson 6.15",
    prompt: "Live scenario / interview: candidate is asked to justify a confident, experience-based recommendation they are tempted to give.",
    passStandard: "Candidate explains, unprompted, why neither confidence nor experience expands certification's actual scope, and declines to give the recommendation.",
    retraining: "Review Lesson 6.15 and Lesson 1.7 (Authority and Power of the Guide Seat); repeat as a structured interview with a new prompt.",
  },
  {
    key: "consultation_referral",
    number: 10,
    title: "Consultation/Referral Judgment",
    source: "Lesson 6.13",
    prompt:
      "Live scenario: a difficult moment arises that is not quite crisis-level. Candidate must decide whether to handle it alone, consult, or refer, and draft an appropriately privacy-protective consultation request if that's the right call.",
    passStandard:
      "Candidate selects the appropriate tier (alone / consult / refer) and, if consulting, produces a request that minimizes identifying detail to what's genuinely needed.",
    retraining: "Review Lesson 6.13 (Peer Consultation) and 6.9 (Safety/Crisis); repeat with a new difficult-moment scenario.",
  },
];

export type PracticumRowReference = { key: PracticumRowKey; competency: string; source: string; watchesFor: string };

export const PRACTICUM_ROW_REFERENCE: PracticumRowReference[] = [
  { key: "iap", competency: "IAP — Associative Listening", source: "Lesson 2.2", watchesFor: "Follows the Host's own language and associations rather than reorganizing the account; offers reflections that may stand rather than declarations." },
  { key: "cat", competency: "CAT — Landscape, Not Funnel", source: "Lesson 2.3", watchesFor: "Lets contradictory elements of the Host's account coexist; does not narrow toward a single conclusion." },
  { key: "innercompass", competency: "InnerCompass — Choice Without Certainty", source: "Lesson 2.4", watchesFor: "Supports a Host's stated choice without supplying or implying an outcome guarantee." },
  { key: "stage_recognition", competency: "Stage Recognition", source: "Lesson 2.6", watchesFor: "Does not move the Host to the next stage before genuine readiness; can articulate why they stayed or moved." },
  { key: "difficult_host_patterns", competency: "Difficult Host Patterns", source: "Lesson 3.6", watchesFor: "Responds appropriately to at least four of: talkative, quiet, contradictory, advice-seeking, reassurance-seeking Host behavior." },
  { key: "mistake_and_repair", competency: "Guide Mistake and Repair", source: "Lesson 3.9", watchesFor: "Executes Notice → Acknowledge → Return Ownership → Repair → Continue cleanly, without defending intent or soliciting reassurance." },
  { key: "capacity_reading", competency: "Capacity Reading and Response", source: "Lessons 4.6, 4.7", watchesFor: "Notices capacity signals, checks rather than assumes, and adjusts or stops appropriately without requiring justification." },
  { key: "recognition_without_intervention", competency: "Recognition Without Intervention", source: "Lesson 5.17", watchesFor: "Correctly recognizes a Secondary Loss or virtue pattern and deliberately withholds it when timing, relevance, or Host ownership don't support voicing it." },
  { key: "boundary_holding", competency: "Boundary Holding Under Pressure", source: "Module 6 (cross-reference Boundary Gate)", watchesFor: "Sustains non-prescription, non-diagnosis, and scope boundaries across a full session, not only in isolated drills." },
  { key: "ending_without_forced_resolution", competency: "Ending Without Forced Resolution", source: "Lesson 3.14", watchesFor: "Closes a session honestly, without manufactured closure, forced optimism, or an artificial next step, when the Host hasn't reached resolution." },
  { key: "full_platform_workflow", competency: "Full Platform Workflow", source: "Module 7 capstone", watchesFor: "Independently opens, navigates, supports, and closes or continues a Host's use of AVAIA, unprompted, without hunting for basic functions." },
];

/** Lab-specific evaluator checks that the candidate must not see. Only the labs
 *  whose evaluator checks the approved Lab Manual provides are listed here. */
export const LAB_EVALUATOR_CHECKS: Record<string, { title: string; checks: string[]; limit?: string }> = {
  "lab-14": {
    title: "Lab 14, Peer Consultation: evaluator checks",
    checks: [
      "Relevant facts?",
      "Did they unnecessarily include: Host identity?",
      "Did they unnecessarily include: private details irrelevant to consultation?",
      "Did they unnecessarily include: interpretations presented as fact?",
      "Did they unnecessarily include: speculation about motive?",
    ],
    limit: "Important limit: the consultation Lab cannot test nonexistent crisis procedures. It tests the judgment and privacy discipline surrounding consultation.",
  },
};

/** The Retry Rule, shown to evaluators beside the lab evaluation form. */
export const RETRY_RULE =
  "A retry must change the story while preserving the competency. A candidate who struggles with the Quiet Host does not replay the exact same Host until they memorize when to stay silent: they receive a different quiet Host. That gives evidence of transfer, rather than evidence that someone learned the answer to a scenario.";

/** The Practice Lab completion standard, shown to evaluators. */
export const PRACTICE_COMPLETION_STANDARD =
  "The candidate has completed the Practice Lab stage when: all 15 conditions have been encountered; feedback has been received; required targeted retries have occurred; and the candidate has demonstrated the ability to Receive, Understand, Adjust, and Try Again. Practice Lab completion is not certification: the Observed Practicum establishes the rest.";

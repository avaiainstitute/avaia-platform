import "server-only";
import {
  CERTIFICATION_CONTENT_VERSION,
  findCurriculumItemsByKeyword,
  getCurriculumItemByKey,
  getModule,
  isHeldItem,
  type CertificationCurriculumItem,
} from "@/lib/certification-content";
import type { ActiveCandidate, CandidateProgressRow } from "@/lib/certification";

export const COMPANION_GUARDRAILS = `
You are the AVAIA Certification Companion. You help a candidate currently working
toward AVAIA Guide Certification. You may: explain approved AVAIA certification
material, answer questions about it, help the candidate navigate the curriculum,
tell them where they left off, remind and check in, support approved practice and
rehearsal, and point toward remediation already described in the material.

You must NOT:
- Invent AVAIA content or policy. If something is not in the material provided to
  you below, say plainly that you don't have that and that it may need to come
  from Dorian or an evaluator -- never guess or improvise an answer.
- Expose or describe evaluator-only material: scoring standards, answer keys,
  Boundary Gate pass standards, Practicum rubrics, Witness Cards, Facilitator
  Cards, or any evaluator commentary. You were not given this material; if asked
  for it, say it isn't something you have access to.
- Waive, soften, or reinterpret any requirement.
- Change, imply, or guess at the candidate's evidence, candidacy status, or
  certification standing. You can only ever report what the candidate has
  self-reported finishing -- never present that as an evaluation.
- Make or hint at a certification decision. Boundary Gate and Observed Practicum
  judgments, and the certification decision itself, are made by a human
  evaluator, never by you.

A lesson marked HELD in the material below is explicitly unresolved AVAIA policy
-- say so plainly ("that one is still pending an AVAIA policy decision") rather
than filling it in yourself.

If a candidate's question reaches into an area requiring human judgment,
disputes a recorded evaluation, asks you to waive or bend a requirement, or is
about something the material below doesn't cover with a confident answer, say
you're flagging it for a person to follow up on, and keep your own reply limited
to acknowledging that rather than attempting it yourself.
`.trim();

export function buildCandidateContextBlock(
  candidate: ActiveCandidate,
  progress: CandidateProgressRow[],
  recentActivity: { entry_type: string; recorded_at: string }[]
): string {
  const progressLines =
    progress.length > 0
      ? progress.map((p) => `- ${p.item_key}: ${p.status}`).join("\n")
      : "(No items self-reported yet.)";
  const lastActivity = recentActivity[0]
    ? `${recentActivity[0].entry_type} on ${new Date(recentActivity[0].recorded_at).toISOString().slice(0, 10)}`
    : "No recorded activity yet.";

  return `
CANDIDATE CONTEXT (recomputed fresh this turn -- not conversation history):
- Candidacy status: ${candidate.status}
- Admitted: ${new Date(candidate.admitted_at).toISOString().slice(0, 10)}
- Most recent recorded activity: ${lastActivity}
- Self-reported item progress:
${progressLines}

This is self-report only -- it is not evaluation and has no bearing on
certification eligibility by itself.
`.trim();
}

function renderLessonContent(item: Extract<CertificationCurriculumItem, { item_type: "lesson" }>): string {
  if (isHeldItem(item)) {
    return `[${item.item_key}] ${item.title} -- HELD: this lesson is explicitly marked unresolved AVAIA policy. There is no approved content to give yet; tell the candidate it is still pending a policy decision from AVAIA.`;
  }
  const moduleName = getModule(item.module_num)?.title;
  const parts: string[] = [`[${item.item_key}] ${item.title}${moduleName ? ` (Module ${item.module_num}: ${moduleName})` : ""}`];
  if (item.purpose) parts.push(`Purpose: ${item.purpose}`);
  if (item.outcomes?.length) parts.push(`Learning outcomes:\n${item.outcomes.map((o) => `- ${o}`).join("\n")}`);
  if (item.teaching?.length) parts.push(`Teaching content:\n${item.teaching.join("\n\n")}`);
  return parts.join("\n\n");
}

function renderLabContent(item: Extract<CertificationCurriculumItem, { item_type: "practice_lab" }>): string {
  const parts: string[] = [`[${item.item_key}] ${item.title} (Practice Lab)`];
  if (item.competency) parts.push(`Competency: ${item.competency}`);
  if (item.establishedGround?.length) parts.push(`Established ground:\n${item.establishedGround.join("\n")}`);
  if (item.host) parts.push(`Host Card:\n${JSON.stringify(item.host)}`);
  if (item.guide) parts.push(`Guide Card:\n${JSON.stringify(item.guide)}`);
  return parts.join("\n\n");
}

export function renderCurriculumItemForPrompt(item: CertificationCurriculumItem): string {
  return item.item_type === "lesson" ? renderLessonContent(item) : renderLabContent(item);
}

export function resolveContentForMessage(message: string, explicitItemKey?: string | null): CertificationCurriculumItem[] {
  if (explicitItemKey) {
    const item = getCurriculumItemByKey(explicitItemKey);
    return item ? [item] : [];
  }
  return findCurriculumItemsByKeyword(message, 3);
}

export function buildSystemPrompt(
  candidateContextBlock: string,
  matchedItems: CertificationCurriculumItem[]
): string {
  const contentBlock =
    matchedItems.length > 0
      ? `RELEVANT APPROVED CONTENT FOR THIS TURN (content version ${CERTIFICATION_CONTENT_VERSION.curriculumVersion}):\n\n${matchedItems
          .map(renderCurriculumItemForPrompt)
          .join("\n\n" + "=".repeat(40) + "\n\n")}`
      : `No specific curriculum item matched this message confidently. If the candidate is asking about specific AVAIA certification content, say you're not sure which lesson or Lab they mean and ask them to name it, rather than guessing.`;

  return [COMPANION_GUARDRAILS, candidateContextBlock, contentBlock].join("\n\n" + "=".repeat(60) + "\n\n");
}

const WAIVER_PATTERNS: RegExp[] = [
  /\b(waive|skip|exempt(ion)?|don'?t (have to|need to) (do|complete|finish))\b.*\b(requirement|lab|lesson|assessment|boundary gate|practicum)\b/i,
  /\bcan i (just )?skip\b/i,
  /\bdo i (really|actually) have to\b/i,
];

const DISPUTE_PATTERNS: RegExp[] = [
  /\b(disagree|dispute|contest|unfair|wrong)\b.*\b(evaluat|rating|decision|evidence|grade|score)\b/i,
  /\bwhy (was i|did i get)\b.*\b(development.required|not.certified|critical.fail)\b/i,
];

const JUDGMENT_TERRITORY_PATTERNS: RegExp[] = [
  /\bboundary gate\b.*\b(pass|fail|standard|result)\b/i,
  /\bobserved practicum\b.*\b(pass|fail|standard|result|rubric)\b/i,
  /\bam i (certified|going to pass|going to be certified)\b/i,
];

export type EscalationCategory = "waiver_request" | "evaluation_dispute" | "judgment_territory" | "no_confident_match";

export function detectCertificationEscalation(
  message: string,
  matchedItems: CertificationCurriculumItem[]
): EscalationCategory | null {
  if (WAIVER_PATTERNS.some((re) => re.test(message))) return "waiver_request";
  if (DISPUTE_PATTERNS.some((re) => re.test(message))) return "evaluation_dispute";
  if (JUDGMENT_TERRITORY_PATTERNS.some((re) => re.test(message))) return "judgment_territory";
  if (matchedItems.length === 0 && /\?/.test(message)) return "no_confident_match";
  return null;
}

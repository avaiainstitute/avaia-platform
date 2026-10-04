import "server-only";
import { getPracticeLabByKey, getPracticeLabs, type CertificationPracticeLab } from "@/lib/certification-content";

// AI HOST PRACTICE. A candidate rehearses a Practice Lab against an AI that plays
// the Host. This is rehearsal only:
//
//   * The AI plays the Host from the lab's Host Card and nothing else. The Witness
//     card, the Facilitator card, every evaluator check, pass standard and rubric
//     live in files this module never imports (the Practice Lab content here is the
//     candidate-visible content file only, and a build-time check keeps the
//     evaluator reference away from everything but admin screens).
//   * The AI never evaluates, scores, rates, hints or certifies. Practice here is
//     not evidence; the evaluation of a Lab is a person's, recorded by a person.
//   * The existing crisis safety net applies: the prompt carries the same crisis
//     instruction the rest of AVAIA uses.

export const PRACTICE_SESSION_MESSAGE_CAP = 80;
export const PRACTICE_MESSAGE_MAX_CHARS = 4000;

/** Lab 12 has Scenarios A, B and C. A and B are open early (they are about
 *  scope and changed consent); C (immediate safety) opens with the other labs,
 *  once the Boundary Gate is recorded. */
export const LAB12_KEY = "lab-12";
export const LAB12_SCENARIOS = ["A", "B", "C"] as const;
export type Lab12Scenario = (typeof LAB12_SCENARIOS)[number];
const LAB12_EARLY: Lab12Scenario[] = ["A", "B"];

type Block = { t?: string; text?: string; items?: unknown };

function asBlocks(value: unknown): Block[] {
  return Array.isArray(value) ? (value.filter((b) => b && typeof b === "object") as Block[]) : [];
}

function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.t === "list" && Array.isArray(b.items)) return (b.items as unknown[]).filter((x): x is string => typeof x === "string").map((x) => `- ${x}`).join("\n");
      if (typeof b.text !== "string") return "";
      if (b.t === "q") return `Say: "${b.text}"`;
      return b.text;
    })
    .filter(Boolean)
    .join("\n");
}

/** The Host Card for the chosen scenario. For Lab 12 the card holds three
 *  scenarios under note headings ("Scenario A: ..."); only the chosen one is used. */
export function hostCardFor(lab: CertificationPracticeLab, scenario: string | null): string | null {
  const blocks = asBlocks(lab.host);
  if (blocks.length === 0) return null;
  if (lab.item_key !== LAB12_KEY) return blocksToText(blocks);
  if (!scenario || !(LAB12_SCENARIOS as readonly string[]).includes(scenario)) return null;
  const start = blocks.findIndex((b) => b.t === "note" && typeof b.text === "string" && b.text.startsWith(`Scenario ${scenario}:`));
  if (start === -1) return null;
  let end = blocks.length;
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].t === "note" && typeof blocks[i].text === "string" && (blocks[i].text as string).startsWith("Scenario ")) {
      end = i;
      break;
    }
  }
  return blocksToText(blocks.slice(start, end));
}

export type PracticeOption = { labKey: string; scenario: string | null; title: string; available: boolean; reason: string | null };

/** Which Host practices exist and which are open to this candidate right now.
 *  Labs open once the Boundary Gate is recorded; Lab 12 Scenarios A and B are
 *  open earlier. A lab with no Host card (Lab 14, a task done alone) has no AI
 *  Host practice. */
export function practiceOptions(gatePassed: boolean): PracticeOption[] {
  const options: PracticeOption[] = [];
  getPracticeLabs().forEach((lab, i) => {
    if (lab.item_key === LAB12_KEY) {
      for (const s of LAB12_SCENARIOS) {
        const early = (LAB12_EARLY as string[]).includes(s);
        const available = gatePassed || early;
        options.push({
          labKey: lab.item_key,
          scenario: s,
          title: `Lab ${i + 1}: ${lab.title}, Scenario ${s}`,
          available,
          reason: available ? null : "Opens once the Boundary Gate is recorded as met.",
        });
      }
      return;
    }
    if (hostCardFor(lab, null) === null) return;
    options.push({
      labKey: lab.item_key,
      scenario: null,
      title: `Lab ${i + 1}: ${lab.title}`,
      available: gatePassed,
      reason: gatePassed ? null : "Opens once the Boundary Gate is recorded as met.",
    });
  });
  return options;
}

export function mayStartPractice(labKey: string, scenario: string | null, gatePassed: boolean): { ok: true } | { ok: false; error: string } {
  const option = practiceOptions(gatePassed).find((o) => o.labKey === labKey && o.scenario === (scenario ?? null));
  if (!option) return { ok: false, error: "That practice does not exist." };
  if (!option.available) return { ok: false, error: option.reason ?? "That practice is not open yet." };
  return { ok: true };
}

const CRISIS_STEP_OUT = `CRISIS SAFETY, this overrides everything else here:
- This is a practice exercise, but the person typing is real. If their messages read as a real person in real distress outside the exercise (thoughts of suicide or self-harm, intent to harm others, abuse, a medical emergency, or severe psychiatric distress), step out of the role at once. Respond with warmth and compassion, acknowledge that this needs immediate human support, and provide (U.S.): call or text 988 (Suicide & Crisis Lifeline); call 911 for immediate danger; text HOME to 741741 (Crisis Text Line). Stay present. Do not attempt to counsel or resolve it.
- Playing a Host who describes distress as part of the exercise is not a crisis; the person typing being in real danger is.`;

/** The AI Host's instructions. Built from the Host Card only. */
export function buildHostPracticePrompt(args: { labTitle: string; hostCard: string; guideMessagesSoFar: number }): string {
  return `You are playing the HOST in a practice conversation for a trainee AVAIA Guide. The Practice Lab is "${args.labTitle}". The trainee is the Guide. This is rehearsal: the trainee is practicing, and you are their practice partner.

HOW TO PLAY THE HOST
- Play the Host using ONLY the Host Card below. It tells you what you carry and what to say. Do not invent dramatic backstory beyond it. If the Guide asks for something the card does not give, answer plainly and briefly, the way an ordinary person would, without adding material that would change what this exercise practices.
- Speak as the Host, in the first person, in short natural replies (one to four sentences). No stage directions, no narration, no headings.
- Follow the card's instructions about when and how to say specific things. The Guide has sent ${args.guideMessagesSoFar} message(s) so far.
- You are not a coach, an evaluator or a judge. NEVER say how the Guide is doing, never rate, score, praise or criticize their approach, never hint at what they should have done, never say what the exercise is testing, and never say whether they would pass. If asked how they did, say that a person at AVAIA gives feedback on practice, not you.
- You are not a Guide, counselor or therapist and you do not give advice. You are the Host.
- Stay in the role. Do not break character unless the crisis instruction below applies.

HOST CARD
${args.hostCard}

${CRISIS_STEP_OUT}`;
}

export function labTitleFor(labKey: string): string | null {
  return getPracticeLabByKey(labKey)?.title ?? null;
}

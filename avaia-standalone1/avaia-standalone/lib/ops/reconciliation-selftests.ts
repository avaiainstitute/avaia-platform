import "server-only";
import { CONVERSATIONS, ROLES, SEATS } from "@/lib/institution";
import {
  ROOM_INSTRUCTIONS,
  TABLE_FORMATION_INSTRUCTIONS,
  preparationWorkspaceSystemPrompt,
  roomSystemPromptFor,
} from "@/lib/engine/prompts";
import { getLessonByKey } from "@/lib/certification-content";
import { virtuesForName } from "@/lib/virtues";
import * as signatureConstants from "@/lib/virtue-signature-constants";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR THE FOUNDER RECONCILIATION OF 2026-10-04. Simulated inputs only: nothing is
// read from or written to the database. They protect the decisions that were made, so that a
// later change (or a later AI-generated document) cannot quietly bring the old wording back:
//
//   * the Host owns the Room and the Table; the Guide facilitates and never owns it;
//   * the Witness is a standing function, not a person, and not "human, system, or both";
//   * Preparation GPT is a human Guide-side tool used while the Guide is working with the Host,
//     not a step that comes before IAP;
//   * the Virtue Formula's governing term is Desired Outcome (not Observable Outcome);
//   * the Virtue Signature has no six "layers", is not a one-time list, and keeps the Founder's
//     structure (identity, Vulnerability + Authenticity, a next ring of up to eight);
//   * the DORIAN example is Dignity, Originality, Respect, Individuality, Authenticity, Nobility.
//
// The Virtue Formula's ELEMENT SELECTION is an open Founder decision and is deliberately NOT
// tested here: nothing in this file encodes who chooses the elements.

type Case = { name: string; ok: boolean };

function result(key: string, label: string, passDetail: string, cases: Case[]): CheckResult {
  const failed = cases.filter((c) => !c.ok).map((c) => c.name);
  return failed.length === 0
    ? { category: "quality", checkKey: key, label, status: "pass", detail: passDetail }
    : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
}

function founderReconciliationCheck(): CheckResult {
  const key = "pipeline_founder_reconciliation";
  const label = "Founder decisions (Room, Witness, Preparation, Formula, Signature) still hold";
  try {
    const cases: Case[] = [];

    // Room: the Host owns it.
    const witnessRole = ROLES.find((r) => r.key === "witness")?.charge ?? "";
    const prompt = roomSystemPromptFor(["Dana", "Lee"], false, "Dana");
    cases.push({ name: "the Room prompt does not say the Host owns the Room", ok: /belong to the\s+Host/i.test(ROOM_INSTRUCTIONS) && /never own it/i.test(ROOM_INSTRUCTIONS) });
    cases.push({ name: "the Room prompt was not told who the Host is", ok: prompt.includes("THE HOST OF THIS ROOM") && prompt.includes("Dana") });
    cases.push({ name: "a Room with no recorded Host named one anyway", ok: !roomSystemPromptFor(["Dana"], false, null).includes("THE HOST OF THIS ROOM") });

    // Witness: a function, not a person.
    cases.push({ name: "the Witness role still says it is human, system, or both", ok: !/human,\s*system,\s*or both/i.test(witnessRole) && /not a person/i.test(witnessRole) });
    cases.push({ name: "the Witness seat is described as a person", ok: /not a person/i.test(SEATS.find((s) => s.name === "Witness")?.text ?? "") });
    cases.push({ name: "the Room prompt makes the Witness a person or a participant", ok: /Witness is not a person/i.test(ROOM_INSTRUCTIONS) && /no\s+single voice takes over/i.test(ROOM_INSTRUCTIONS) });
    cases.push({ name: "the Table Formation prompt lost the Witness function", ok: /not a person/i.test(TABLE_FORMATION_INSTRUCTIONS) && /no\s+single voice takes over/i.test(TABLE_FORMATION_INSTRUCTIONS) });

    // Preparation GPT: a human Guide-side tool used during the work.
    const prep = CONVERSATIONS.find((c) => c.slug === "preparation");
    const prepText = prep ? JSON.stringify(prep) : "";
    cases.push({ name: "Preparation GPT is described as occurring before any core conversation", ok: !!prep && !/before any core conversation/i.test(prepText) && /actively working/i.test(prepText) });
    cases.push({ name: "IAP is still positioned after Preparation GPT", ok: !CONVERSATIONS.some((c) => /Preparation GPT\s*→/.test(c.position ?? "")) });
    const prepPrompt = preparationWorkspaceSystemPrompt();
    cases.push({ name: "the Preparation prompt is not a Guide-side, during-the-work tool", ok: /actively\s+working\s+with\s+the\s+Host/i.test(prepPrompt) && /Guide's own account/i.test(prepPrompt) });
    cases.push({ name: "the Preparation prompt lost the capacity boundary", ok: /does\s+not\s+push\s+the\s+conversation\s+further/i.test(prepPrompt) });

    // Virtue Formula: Desired Outcome.
    const lesson = getLessonByKey("lesson-5.14");
    const lessonText = lesson ? JSON.stringify(lesson) : "";
    cases.push({ name: "lesson 5.14 is missing", ok: !!lesson });
    cases.push({ name: "lesson 5.14 still teaches 'Observable Outcome'", ok: !/observable outcome/i.test(lessonText) && /Desired Outcome/.test(lessonText) });

    // Virtue Signature: no six layers, not a one-time list, Founder structure.
    const exported = Object.keys(signatureConstants);
    cases.push({ name: "the six Signature layers are exported again", ok: !exported.some((k) => /LAYER/i.test(k)) });
    cases.push({ name: "the next ring is not the Founder's eight", ok: signatureConstants.NEXT_RING_CAPACITY === 8 });
    cases.push({ name: "the first ring is not Vulnerability + Authenticity", ok: signatureConstants.IDENTITY_FIRST_RING.map((r) => r.element).join("+") === "Vulnerability+Authenticity" });
    const mk = (id: string, family: string, element: string | null) =>
      ({ id, host_id: "h", guide_participant_id: null, family, element, note: null, source_type: "self", source_reference: null, status: "active", created_at: "", updated_at: "" }) as signatureConstants.VirtueSignatureEntry;
    const grouped = signatureConstants.groupByElement([
      mk("1", "Integrity", "Courage"),
      mk("2", "Fortitude", "Courage"),
      mk("3", "Integrity", "Courage"),
      mk("4", "Wisdom", null),
    ]);
    cases.push({ name: "the same virtue recorded in different experiences was not kept together as one pattern", ok: grouped.length === 3 && grouped[0].entries.length === 2 });

    // The DORIAN example.
    const dorian = virtuesForName("Dorian").map((l) => (l.kind === "virtue" ? l.virtue.name : "?")).join(", ");
    cases.push({ name: `DORIAN spells "${dorian}"`, ok: dorian === "Dignity, Originality, Respect, Individuality, Authenticity, Nobility" });

    return result(
      key,
      label,
      "Simulated inputs confirm: the Room prompt names the Host as owner and the Guide as facilitator; the Witness is a function, not a person; Preparation GPT is a Guide-side tool used during the work; lesson 5.14 teaches Desired Outcome; the Virtue Signature has no six layers, keeps repeated experiences together, and keeps the Founder's first ring and a next ring of eight; and DORIAN spells Dignity, Originality, Respect, Individuality, Authenticity, Nobility.",
      cases
    );
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function founderReconciliationChecks(): CheckResult[] {
  return [founderReconciliationCheck()];
}

import "server-only";
import {
  COORDINATE_FROM_FIELDS,
  COORDINATION_KINDS,
  COORDINATION_STATUSES,
  DELEGATION_LABEL,
  DELEGATION_STATES,
  LIMITS,
  STATUS_LABEL,
  WAITING_ON_LABEL,
  WAITING_ON_VALUES,
  defaultKindForField,
  isCoordinateFromField,
  isOverdue,
  isUuid,
  normalizeDueDate,
  parseCoordinationInput,
  sortForDisplay,
  summarizeItems,
} from "@/lib/coordination";
import { referralItemText } from "@/lib/kept-items";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR COORDINATION (Workbook, Phase 1). Simulated records only: nothing is read from or
// written to the database. They run the very same rules production runs, so if a future change
// quietly breaks one of these promises the next System Check reports it:
//
//   * every state is Host-selected and exactly the approved vocabulary: the seven delegation
//     states, Open / Waiting / Closed, and the five waiting-on choices;
//   * nothing is defaulted or inferred: an unchosen ownership state stays unchosen;
//   * Waiting always says what it is waiting on, and nothing else carries a waiting-on;
//   * there is no capacity, score or colour input anywhere;
//   * "Add to Coordination" can start only from the Host's own decisions and commitments, never
//     from a stage's own next-step synthesis (Decision 0006).
//
// The database half of the promise (Host-only policies, adults only, no delete, the guard trigger)
// is proven against the live catalog by schema_rules in lib/ops/system-truth.ts.

type Case = { name: string; ok: boolean };

const valid = { kind: "item", title: "Call the attorney", status: "open" } as const;

function coordinationCheck(): CheckResult {
  const key = "pipeline_coordination";
  const label = "Coordination behaves as designed";
  try {
    const cases: Case[] = [];

    // Vocabulary: exactly what the Founder approved.
    cases.push({
      name: "the delegation states are not exactly the seven approved",
      ok:
        DELEGATION_STATES.length === 7 &&
        ["i_own_and_will_do", "i_own_decision_others_carry_out", "someone_else_owns", "belongs_with_professional", "can_wait", "need_help_before_deciding", "no_capacity_now"].every((s) =>
          (DELEGATION_STATES as readonly string[]).includes(s)
        ),
    });
    cases.push({ name: "a delegation state has no label", ok: DELEGATION_STATES.every((s) => DELEGATION_LABEL[s].length > 0) });
    cases.push({ name: "status is not exactly Open, Waiting, Closed", ok: COORDINATION_STATUSES.join(",") === "open,waiting,closed" && COORDINATION_STATUSES.every((s) => STATUS_LABEL[s].length > 0) });
    cases.push({
      name: "waiting-on is not exactly host, guide, family_member, professional, other",
      ok: WAITING_ON_VALUES.join(",") === "host,guide,family_member,professional,other" && WAITING_ON_VALUES.every((w) => WAITING_ON_LABEL[w].length > 0),
    });
    cases.push({ name: "the kinds are not exactly item and decision", ok: COORDINATION_KINDS.join(",") === "item,decision" });

    // Nothing is defaulted or inferred.
    const bare = parseCoordinationInput({ title: "  Sort out the house  " });
    cases.push({ name: "a bare item did not parse", ok: bare.ok });
    if (bare.ok) {
      cases.push({ name: "the title was not trimmed", ok: bare.value.title === "Sort out the house" });
      cases.push({ name: "an unchosen ownership state was filled in", ok: bare.value.delegation_state === null });
      cases.push({ name: "a new item did not start Open", ok: bare.value.status === "open" && bare.value.kind === "item" });
      cases.push({ name: "an unchosen field was filled in", ok: bare.value.waiting_on === null && bare.value.due_date === null && bare.value.next_action === null && bare.value.category === null });
      const keys = Object.keys(bare.value).join(" ").toLowerCase();
      cases.push({ name: "a capacity, score or colour input exists", ok: !/capacity|score|color|colour|green|yellow|red\b|infer/.test(keys) });
    }

    // Validation.
    cases.push({ name: "a blank title was accepted", ok: !parseCoordinationInput({ ...valid, title: "   " }).ok });
    cases.push({ name: "an over-long title was accepted", ok: !parseCoordinationInput({ ...valid, title: "x".repeat(LIMITS.title + 1) }).ok });
    cases.push({ name: "an unknown ownership state was accepted", ok: !parseCoordinationInput({ ...valid, delegation_state: "has_capacity" }).ok });
    cases.push({ name: "an approved ownership state was refused", ok: parseCoordinationInput({ ...valid, delegation_state: "no_capacity_now" }).ok });
    cases.push({ name: "an unknown status was accepted", ok: !parseCoordinationInput({ ...valid, status: "red" }).ok });
    cases.push({ name: "an unknown kind was accepted", ok: !parseCoordinationInput({ ...valid, kind: "capacity_review" }).ok });
    cases.push({ name: "an impossible date was accepted", ok: !parseCoordinationInput({ ...valid, due_date: "2026-02-31" }).ok && normalizeDueDate("2026-02-28") === "2026-02-28" });

    // Waiting always names what it waits on; nothing else carries it.
    cases.push({ name: "Waiting without a waiting-on was accepted", ok: !parseCoordinationInput({ ...valid, status: "waiting" }).ok });
    cases.push({ name: "Waiting with an unknown waiting-on was accepted", ok: !parseCoordinationInput({ ...valid, status: "waiting", waiting_on: "the courts" }).ok });
    const waiting = parseCoordinationInput({ ...valid, status: "waiting", waiting_on: "professional", waiting_on_note: "Attorney's office" });
    cases.push({ name: "a valid Waiting item did not parse", ok: waiting.ok && waiting.value.waiting_on === "professional" && waiting.value.waiting_on_note === "Attorney's office" });
    const stale = parseCoordinationInput({ ...valid, status: "open", waiting_on: "host", waiting_on_note: "old note" });
    cases.push({ name: "an Open item kept a waiting-on", ok: stale.ok && stale.value.waiting_on === null && stale.value.waiting_on_note === null });
    const closed = parseCoordinationInput({ ...valid, status: "closed", waiting_on: "guide" });
    cases.push({ name: "a Closed item kept a waiting-on", ok: closed.ok && closed.value.waiting_on === null });

    // Dates and display.
    const today = "2026-10-10";
    cases.push({ name: "a past due date on an open item was not overdue", ok: isOverdue({ status: "open", due_date: "2026-10-01" }, today) });
    cases.push({ name: "a closed item was reported overdue", ok: !isOverdue({ status: "closed", due_date: "2026-10-01" }, today) });
    cases.push({ name: "an undated item was reported overdue", ok: !isOverdue({ status: "open", due_date: null }, today) });
    const summary = summarizeItems(
      [
        { status: "open", due_date: "2026-10-01" },
        { status: "waiting", due_date: null },
        { status: "closed", due_date: "2026-10-01" },
      ],
      today
    );
    cases.push({ name: "the summary counts are wrong", ok: summary.open === 1 && summary.waiting === 1 && summary.closed === 1 && summary.overdue === 1 });
    const sorted = sortForDisplay([
      { due_date: null, created_at: "2026-10-03" },
      { due_date: "2026-10-20", created_at: "2026-10-01" },
      { due_date: "2026-10-05", created_at: "2026-10-02" },
    ]);
    cases.push({ name: "items were not ordered by due date with undated last", ok: sorted[0].due_date === "2026-10-05" && sorted[1].due_date === "2026-10-20" && sorted[2].due_date === null });
    cases.push({ name: "an id check accepted a non-id", ok: isUuid("11111111-2222-3333-4444-555555555555") && !isUuid("not-an-id") && !isUuid("") });

    // "Add to Coordination": only the Host's own decisions and commitments.
    cases.push({ name: "Add to Coordination is not limited to decisions and commitments", ok: COORDINATE_FROM_FIELDS.join(",") === "decisionsMade,commitmentsChosen" });
    for (const notHostVoice of ["nextStep", "hostOverview", "currentConcern", "restorationTargets"]) {
      cases.push({ name: `a stage's own synthesis (${notHostVoice}) could seed an item`, ok: !isCoordinateFromField(notHostVoice) });
    }
    cases.push({ name: "a decision did not start as a decision", ok: defaultKindForField("decisionsMade") === "decision" && defaultKindForField("commitmentsChosen") === "item" });
    const content = { decisionsMade: ["  Keep the house  ", ""], commitmentsChosen: ["Call my sister"], nextStep: "A stage's own words" };
    cases.push({ name: "a decision was not resolved by field and position", ok: referralItemText(content, "decisionsMade", 0) === "Keep the house" });
    cases.push({ name: "a next step was resolved as the Host's words", ok: referralItemText(content, "nextStep", 0) === null });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated records confirm: every state is Host-selected and exactly the approved vocabulary; nothing is defaulted or inferred; Waiting always names what it waits on; there is no capacity, score or colour input; and Add to Coordination starts only from the Host's own decisions and commitments.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function coordinationChecks(): CheckResult[] {
  return [coordinationCheck()];
}

// AVAIA Guide Toolkit — Experience Detail sections. Ordered, typed
// content blocks attached to an Experience (migration 0021). Pilot
// slice: one Experience ("The Things We Lose After the Loss"), admin
// draft-preview only — no Guide-facing route reads this yet.

export type SectionType =
  | "orientation"
  | "governing_distinction"
  | "anchor"
  | "movement"
  | "question"
  | "reference"
  | "activity"
  | "conversation_window"
  | "guide_preparation"
  | "boundary"
  | "take_home"
  | "format_variant"
  | "success_definition"
  | "participant_guide";

export const SECTION_TYPES: SectionType[] = [
  "orientation",
  "governing_distinction",
  "anchor",
  "movement",
  "question",
  "reference",
  "activity",
  "conversation_window",
  "guide_preparation",
  "boundary",
  "take_home",
  "format_variant",
  "success_definition",
  "participant_guide",
];

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  orientation: "Orientation",
  governing_distinction: "Governing Distinction",
  anchor: "Anchor",
  movement: "The Arc",
  question: "Signature Question",
  reference: "Reference",
  activity: "Activities",
  conversation_window: "Conversation Windows",
  guide_preparation: "Guide Preparation",
  boundary: "Protected Boundaries",
  take_home: "Take-Home",
  format_variant: "Format Variants",
  success_definition: "Definition of Success",
  participant_guide: "Participant Guide",
};

export type ExperienceSectionStatus = "draft" | "published" | "archived";

export type ExperienceSection = {
  id: string;
  experience_id: string;
  section_type: SectionType;
  position: number;
  title: string | null;
  body: string;
  status: ExperienceSectionStatus;
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Groups an Experience's sections by type, each group already ordered
 *  by `position`. Groups with zero rows are simply absent from the
 *  result — the renderer must not invent a placeholder for a category
 *  an Experience's source doesn't support. */
export function groupSectionsByType(
  sections: ExperienceSection[]
): Partial<Record<SectionType, ExperienceSection[]>> {
  const grouped: Partial<Record<SectionType, ExperienceSection[]>> = {};
  for (const type of SECTION_TYPES) {
    const rows = sections
      .filter((s) => s.section_type === type)
      .sort((a, b) => a.position - b.position);
    if (rows.length > 0) grouped[type] = rows;
  }
  return grouped;
}

/** One labeled clause parsed out of a `movement` section's body -- e.g.
 *  "Purpose: give participants..." becomes { label: "Purpose", text:
 *  "give participants..." }. Every Defying Grief Master Curriculum
 *  module (migration 0033) was authored with this exact labeled-clause
 *  convention specifically so a delivery interface could split one
 *  flowing paragraph back into distinct, scannable fields without a
 *  schema change or a rewrite of the stored content. Not a general
 *  content-authoring rule for every section_type -- only movement
 *  bodies follow it today. */
export type ModuleField = { label: string; text: string };

const MODULE_FIELD_PATTERN =
  /\b(Movement|Purpose|Core idea|Facilitator teaching|Key distinctions?|Shared-room experience|Private reflection(?: \/ take-home)?|Activit(?:y|ies)|Optional AVAIA conversation|Guide boundaries|Transition|Closing):\s*/g;

/** Canonical reading order for a module's parsed fields, independent of
 *  the order labels happen to appear in the stored body text (that order
 *  varies slightly module to module, since each was written the way it
 *  reads most naturally). "Movement" is excluded -- callers use it for
 *  grouping/badging, not as a displayed field. */
const MODULE_FIELD_DISPLAY_ORDER = [
  "Purpose",
  "Core idea",
  "Facilitator teaching",
  "Key distinction",
  "Key distinctions",
  "Activity",
  "Activities",
  "Shared-room experience",
  "Private reflection",
  "Private reflection / take-home",
  "Optional AVAIA conversation",
  "Guide boundaries",
  "Transition",
  "Closing",
];

/** Splits a movement body into its labeled clauses, in canonical display
 *  order. Returns an empty array (not the raw body) if the body doesn't
 *  follow the labeled-clause convention -- callers should fall back to
 *  rendering the raw body text in that case, never invent fields. */
export function parseModuleFields(body: string): ModuleField[] {
  const matches = [...body.matchAll(MODULE_FIELD_PATTERN)];
  if (matches.length === 0) return [];
  const fields: ModuleField[] = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1];
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const text = body.slice(start, end).trim();
    if (label !== "Movement" && text) fields.push({ label, text });
  }
  return fields.sort(
    (a, b) => MODULE_FIELD_DISPLAY_ORDER.indexOf(a.label) - MODULE_FIELD_DISPLAY_ORDER.indexOf(b.label)
  );
}

/** Reads just the movement word ("Awareness" / "Understanding" /
 *  "Agency") from a module body's leading "Movement: X." clause, for
 *  grouping modules in the curriculum view. Returns null if the body
 *  doesn't start with a recognized movement clause. */
export function parseModuleMovement(body: string): "Awareness" | "Understanding" | "Agency" | null {
  const match = body.match(/^Movement:\s*(Awareness|Understanding|Agency)\./);
  return (match?.[1] as "Awareness" | "Understanding" | "Agency" | undefined) ?? null;
}

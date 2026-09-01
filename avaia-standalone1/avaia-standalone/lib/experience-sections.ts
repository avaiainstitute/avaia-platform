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

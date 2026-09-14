// Agent 8 (Programs & Experiences), Automation Blueprint Round 3. Shared
// constants only (no server-only logic) so this file is safely importable
// from both the client form (components/ExperienceInquiryForm.tsx) and
// server code (app/api/experiences/inquiry/route.ts, app/admin/programs) --
// same posture as ContactForm.tsx's own inline REASONS list, just
// centralized since this set is reused in more than one place.
//
// Every value here names an AVAIA Program or Experience that already
// exists in this codebase (lib/institution.ts's PROGRAMS list, or an
// already-published app/ page) -- nothing invented.

export const EXPERIENCE_TYPES = [
  "defying_grief",
  "youth_defying_grief",
  "workshops_and_speaking",
  "chemistry_of_virtue",
  "unsung_heroes",
  "view_from_above",
  "other",
] as const;
export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export const EXPERIENCE_LABEL: Record<ExperienceType, string> = {
  defying_grief: "Defying Grief (workshop, retreat, or school/organization program)",
  youth_defying_grief: "Youth Defying Grief (group, workshop, or school program)",
  workshops_and_speaking: "A Workshop or Speaking Presentation",
  chemistry_of_virtue: "Chemistry of Virtue",
  unsung_heroes: "Unsung Heroes",
  view_from_above: "The View From Above",
  other: "Something else established at AVAIA",
};

export const GROUP_TYPES = [
  "school",
  "business",
  "faith_community",
  "community_organization",
  "conference",
  "other",
] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  school: "School",
  business: "Business",
  faith_community: "Faith Community",
  community_organization: "Community Organization",
  conference: "Conference",
  other: "Other",
};

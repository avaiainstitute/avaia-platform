// AVAIA Experience/Class Toolkit — shared types and small constants.
// Minimum first slice: the data layer plus a read-only Guide browse view
// only. No Experience Builder, no admin CRUD UI, no event/group
// infrastructure, no certification-tier gating — none of that is built
// yet. Content is seeded directly via migration 0020, the same way
// Library content has always been added (there is no admin UI for this
// either).

import type { ToolKey } from "@/lib/toolkit";
import type { Stage } from "@/lib/engine/prompts";

export type ExperienceClassStatus = "draft" | "published" | "archived";

export type ClassFamily =
  | "self"
  | "relationships"
  | "life_change"
  | "virtue_contribution"
  | "clarity_agency";

export const CLASS_FAMILY_LABEL: Record<ClassFamily, string> = {
  self: "Self",
  relationships: "Relationships",
  life_change: "Life & Change",
  virtue_contribution: "Virtue & Contribution",
  clarity_agency: "Clarity & Agency",
};

export type Experience = {
  id: string;
  title: string;
  summary: string | null;
  status: ExperienceClassStatus;
  components: ToolKey[];
  conversation_stages: Stage[];
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AvaiaClass = {
  id: string;
  title: string;
  family: ClassFamily;
  summary: string | null;
  status: ExperienceClassStatus;
  components: ToolKey[];
  conversation_stages: Stage[];
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Validate a component tag against the existing Guide Toolkit's own
 *  ToolKey vocabulary (lib/toolkit.ts) — deliberately not a second
 *  taxonomy. A tag naming an unbuilt tool (e.g. "table-formation",
 *  "council") is still valid; referencing a component never requires
 *  it to exist yet. */
export function isValidComponentTag(tag: string): tag is ToolKey {
  const known: ToolKey[] = [
    "preparation",
    "iap",
    "cat",
    "innercompass",
    "secondary-loss",
    "chemistry",
    "table-formation",
    "council",
    "give",
    "defying-grief",
    "unsung-heroes",
    "library",
    "youth-defying-grief",
    "youth-group",
  ];
  return (known as string[]).includes(tag);
}

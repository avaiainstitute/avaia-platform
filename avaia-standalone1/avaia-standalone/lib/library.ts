// AVAIA Library — shared types and small constants. Ported from the
// unmerged `library` branch, unchanged in shape. Deliberately NOT
// server-only (matches the original) since UI pieces may need these
// client-side too. Only the data layer + a read-only Guide browse view are
// installed in this pass -- library_suggestions and the admin CRUD/review
// UI are not ported yet.

import { VIRTUE_FAMILIES, VIRTUES, type VirtueFamilyKey } from "@/lib/virtues";
import { SECONDARY_LOSSES } from "@/lib/institution";
import type { Program, Stage } from "@/lib/engine/prompts";

export type ContentType = "avaia-owned" | "external-resource";
export type LibraryStatus = "draft" | "published" | "archived";
export type LibraryVisibility = "public" | "member";

export type VirtueTag = { family: VirtueFamilyKey; element: string | null };

export type LibraryEntry = {
  id: string;
  title: string;
  great_idea: string;
  overview: string;
  virtues: VirtueTag[];
  secondary_losses: string[];
  journey_stages: Stage[];
  programs: Program[];
  content_type: ContentType;
  body: string | null;
  external_url: string | null;
  external_author: string | null;
  external_description: string | null;
  status: LibraryStatus;
  visibility: LibraryVisibility;
  tags: string[];
  editor_id: string | null;
  created_at: string;
  updated_at: string;
};

export const JOURNEY_STAGE_LABEL: Record<Stage, string> = {
  iap: "Individual Awareness Profile",
  cat: "Conversations Across Time",
  innercompass: "InnerCompass",
};
export const JOURNEY_STAGES: Stage[] = ["iap", "cat", "innercompass"];

export const PROGRAM_LABEL: Record<Program, string> = {
  general: "General Journey",
  "defying-grief": "Defying Grief",
  // Youth Journey, Phase 1: label only exists to satisfy Record<Program, ...>
  // completeness -- Youth is deliberately absent from PROGRAM_KEYS below, so
  // this never actually surfaces in the Library's program filter UI yet.
  youth: "Youth Journey",
};
export const PROGRAM_KEYS: Program[] = ["general", "defying-grief"];

export const SECONDARY_LOSS_NAMES: string[] = SECONDARY_LOSSES.map((s) => s.loss);

/** Validate a virtue tag against the Chemistry of Virtue (lib/virtues.ts). */
export function validateVirtueTag(family: string, element: string | null): VirtueTag | null {
  const fam = VIRTUE_FAMILIES.find((f) => f.key === family);
  if (!fam) return null;
  if (!element) return { family: fam.key, element: null };
  const match = VIRTUES.find(
    (v) => v.family === fam.key && v.name.toLowerCase() === element.toLowerCase()
  );
  return { family: fam.key, element: match?.name ?? null };
}

export function isValidSecondaryLoss(name: string): boolean {
  return SECONDARY_LOSS_NAMES.some((l) => l.toLowerCase() === name.toLowerCase());
}

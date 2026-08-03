// AVAIA Library — shared types and small constants. Deliberately NOT
// server-only (unlike lib/engine/conversation.ts) because the admin form
// components need these client-side too; for the same reason journey stage
// labels are duplicated here in miniature rather than imported from the
// server-only conversation engine.

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

export type LibrarySuggestionStatus = "pending" | "approved" | "rejected";

export type LibrarySuggestion = {
  id: string;
  submitted_by: string;
  title: string;
  author: string | null;
  link: string | null;
  description: string | null;
  why_relevant: string;
  suggested_virtue_family: string | null;
  suggested_virtue_name: string | null;
  suggested_secondary_loss: string | null;
  suggested_program: string | null;
  status: LibrarySuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
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
};
export const PROGRAM_KEYS: Program[] = ["general", "defying-grief"];

export const SECONDARY_LOSS_NAMES: string[] = SECONDARY_LOSSES.map((s) => s.loss);

/** Validate a virtue tag against the Chemistry of Virtue (lib/virtues.ts) —
 *  returns a cleaned tag, or null if the family isn't real. An element that
 *  doesn't match the family is dropped rather than the whole tag rejected. */
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

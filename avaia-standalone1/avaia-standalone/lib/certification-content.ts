import "server-only";
import rawContent from "./certification-content-data/content.json";

// The existing AVAIA certification curriculum (86 lessons, 15 Practice
// Labs), read exactly as stored in certification-content-data/content.json.
// Nothing here rewrites, summarizes, or regenerates a single word of it.
// This module only gives the classroom a typed, ordered way to find it.
//
// Candidate/evaluator isolation is structural: the content file carries only
// candidate-visible fields (no answer keys, no evaluator rubrics, no Witness
// or Facilitator Cards), and nothing in this module reaches any
// evaluator-only table.

export const CERTIFICATION_CONTENT_VERSION = {
  curriculumVersion: "2026-10-01",
  labManualVersion: "2026-10-01",
} as const;

/** The canonical seven-module structure (owner-established). The content
 *  file stores only module numbers; these are the module names. The older
 *  10-phase and six-level structures are NOT the classroom structure. */
export const CERTIFICATION_MODULES = [
  { num: 1, title: "AVAIA Foundations: Experience, Loss & Recognition" },
  { num: 2, title: "The AVAIA Journey: IAP → CAT → InnerCompass" },
  { num: 3, title: "The Guide Seat: Listening & Conversation Stewardship" },
  { num: 4, title: "Capacity: What Someone Wants, Needs & Can Actually Carry" },
  { num: 5, title: "Secondary Losses & Chemistry of Virtue" },
  { num: 6, title: "Boundaries, Privacy, Scope & Safety" },
  { num: 7, title: "Using AVAIA: Toolkit, Platform & Continuity" },
] as const;

export type CertificationModule = (typeof CERTIFICATION_MODULES)[number];

export const CURRICULUM_HELD_TAG = "HELD";

export type CertificationLesson = {
  item_key: string;
  item_type: "lesson";
  module_num: number;
  title: string;
  tag: string | null;
  purpose: string | null;
  outcomes: string[];
  teaching: string[];
  language: string[];
  examples: unknown;
  activity: unknown;
  workbook: unknown;
};

export type CertificationPracticeLab = {
  item_key: string;
  item_type: "practice_lab";
  module_num: null;
  title: string;
  competency: string | null;
  establishedGround: string[] | null;
  note: string | null;
  host: unknown;
  guide: unknown;
  debrief: { role: string; text: string }[];
  retry: string | null;
};

export type CertificationCurriculumItem = CertificationLesson | CertificationPracticeLab;

type ContentFile = {
  lessons: CertificationLesson[];
  practiceLabs: CertificationPracticeLab[];
  generatedAt: string;
};

const content = rawContent as unknown as ContentFile;

const lessons: CertificationLesson[] = content.lessons;
const labs: CertificationPracticeLab[] = content.practiceLabs;
const allItems: CertificationCurriculumItem[] = [...lessons, ...labs];
const byKey = new Map<string, CertificationCurriculumItem>(allItems.map((i) => [i.item_key, i]));

export function getAllCurriculumItems(): CertificationCurriculumItem[] {
  return allItems;
}

export function getCurriculumItemByKey(itemKey: string): CertificationCurriculumItem | null {
  return byKey.get(itemKey) ?? null;
}

export function getLessonByKey(itemKey: string): CertificationLesson | null {
  const item = byKey.get(itemKey);
  return item && item.item_type === "lesson" ? item : null;
}

export function getPracticeLabByKey(itemKey: string): CertificationPracticeLab | null {
  const item = byKey.get(itemKey);
  return item && item.item_type === "practice_lab" ? item : null;
}

export function getAllLessons(): CertificationLesson[] {
  return lessons;
}

export function getPracticeLabs(): CertificationPracticeLab[] {
  return labs;
}

export function getModule(num: number): CertificationModule | null {
  return CERTIFICATION_MODULES.find((m) => m.num === num) ?? null;
}

export function getModuleLessons(num: number): CertificationLesson[] {
  return lessons.filter((l) => l.module_num === num);
}

/** A lesson the curriculum itself marks HELD: unresolved AVAIA policy with
 *  no approved content. It is shown honestly as pending and can never be
 *  opened as coursework or marked complete. */
export function isHeldItem(item: CertificationCurriculumItem): boolean {
  return item.item_type === "lesson" && item.tag === CURRICULUM_HELD_TAG;
}

/** Lessons a candidate can actually work through (everything not HELD). */
export function getCompletableLessons(): CertificationLesson[] {
  return lessons.filter((l) => !isHeldItem(l));
}

export function getHeldLessons(): CertificationLesson[] {
  return lessons.filter((l) => isHeldItem(l));
}

/** Previous/next lesson in the global curriculum order, skipping HELD
 *  lessons (they have nothing to read). */
export function getAdjacentLessons(itemKey: string): { prev: CertificationLesson | null; next: CertificationLesson | null } {
  const readable = getCompletableLessons();
  const idx = readable.findIndex((l) => l.item_key === itemKey);
  if (idx === -1) return { prev: null, next: null };
  return { prev: readable[idx - 1] ?? null, next: readable[idx + 1] ?? null };
}

/** The workbook reflection prompts a lesson carries, as a list (the content
 *  stores either one string or an array of strings). */
export function getWorkbookPrompts(lesson: CertificationLesson): string[] {
  return toStringList(lesson.workbook);
}

export function toStringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return [];
}

export function findCurriculumItemsByKeyword(query: string, limit = 5): CertificationCurriculumItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const scored = allItems
    .map((item) => {
      const title = item.title.toLowerCase();
      const purpose = item.item_type === "lesson" ? (item.purpose ?? "").toLowerCase() : "";
      const outcomes = item.item_type === "lesson" ? item.outcomes.join(" ").toLowerCase() : "";
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 3;
        if (purpose.includes(term)) score += 2;
        if (outcomes.includes(term)) score += 1;
      }
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.item);
}

export function contentGeneratedAt(): string {
  return content.generatedAt;
}

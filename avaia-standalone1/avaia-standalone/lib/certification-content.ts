import "server-only";
import rawContent from "./certification-content-data/content.json";

export const CERTIFICATION_CONTENT_VERSION = {
  curriculumVersion: "2026-10-01",
  labManualVersion: "2026-10-01",
} as const;

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

const content = rawContent as ContentFile;

const allItems: CertificationCurriculumItem[] = [...content.lessons, ...content.practiceLabs];

const byKey = new Map<string, CertificationCurriculumItem>(allItems.map((i) => [i.item_key, i]));

export function getAllCurriculumItems(): CertificationCurriculumItem[] {
  return allItems;
}

export function getCurriculumItemByKey(itemKey: string): CertificationCurriculumItem | null {
  return byKey.get(itemKey) ?? null;
}

export function isHeldItem(item: CertificationCurriculumItem): boolean {
  return item.item_type === "lesson" && item.tag === CURRICULUM_HELD_TAG;
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

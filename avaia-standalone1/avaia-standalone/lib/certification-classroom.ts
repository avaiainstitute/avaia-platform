import "server-only";
import {
  CERTIFICATION_MODULES,
  getAllLessons,
  getPracticeLabs,
  isHeldItem,
  type CertificationLesson,
} from "@/lib/certification-content";
import type { CandidateProgressRow, ProgressStatus } from "@/lib/certification";

// Pure derivation of the candidate's classroom view from their own progress
// rows. No I/O, no clock. Progress is always derived from what the candidate
// actually did (lessons completed), never from a typed-in count.

export type LessonView = {
  itemKey: string;
  title: string;
  held: boolean;
  status: ProgressStatus;
  /** Candidate has saved at least one reflection response for this lesson. */
  hasReflection: boolean;
};

export type ModuleView = {
  num: number;
  title: string;
  lessons: LessonView[];
  /** Lessons a candidate can actually do (everything not HELD). */
  availableCount: number;
  completedCount: number;
  heldCount: number;
  /** True when every available lesson is complete. A module with HELD
   *  lessons is never reported as fully complete, only as "all available
   *  lessons complete". */
  allAvailableComplete: boolean;
  fullyComplete: boolean;
};

export type LabView = {
  itemKey: string;
  title: string;
  status: ProgressStatus;
};

export type ClassroomSummary = {
  modules: ModuleView[];
  labs: LabView[];
  overall: {
    availableLessons: number;
    completedLessons: number;
    heldLessons: number;
    percentOfAvailable: number;
    /** Every currently available lesson is complete. */
    allAvailableComplete: boolean;
    /** Every lesson is complete AND none is held. Only then is the
     *  seven-module education complete in the full sense. */
    educationFullyComplete: boolean;
  };
  labsCompleted: number;
  labsTotal: number;
  /** Where "Resume" should go. */
  resume: {
    lesson: LessonView | null;
    reason: "in_progress" | "next_incomplete" | "all_done";
  };
  lastTouchedAt: string | null;
};

export function buildClassroomSummary(progress: CandidateProgressRow[], lessonsWithReflections: Set<string>): ClassroomSummary {
  const byKey = new Map<string, CandidateProgressRow>(progress.map((p) => [p.item_key, p]));
  const statusOf = (key: string): ProgressStatus => byKey.get(key)?.status ?? "not_started";

  const toLessonView = (l: CertificationLesson): LessonView => ({
    itemKey: l.item_key,
    title: l.title,
    held: isHeldItem(l),
    // A HELD lesson can never read as anything but not started.
    status: isHeldItem(l) ? "not_started" : statusOf(l.item_key),
    hasReflection: lessonsWithReflections.has(l.item_key),
  });

  const lessons = getAllLessons();
  const modules: ModuleView[] = CERTIFICATION_MODULES.map((m) => {
    const views = lessons.filter((l) => l.module_num === m.num).map(toLessonView);
    const available = views.filter((v) => !v.held);
    const completed = available.filter((v) => v.status === "self_checked_complete").length;
    const held = views.length - available.length;
    const allAvailableComplete = available.length > 0 && completed === available.length;
    return {
      num: m.num,
      title: m.title,
      lessons: views,
      availableCount: available.length,
      completedCount: completed,
      heldCount: held,
      allAvailableComplete,
      fullyComplete: allAvailableComplete && held === 0,
    };
  });

  const availableLessons = modules.reduce((n, m) => n + m.availableCount, 0);
  const completedLessons = modules.reduce((n, m) => n + m.completedCount, 0);
  const heldLessons = modules.reduce((n, m) => n + m.heldCount, 0);

  const labs: LabView[] = getPracticeLabs().map((l) => ({ itemKey: l.item_key, title: l.title, status: statusOf(l.item_key) }));

  // Resume: the most recently touched lesson that is not yet complete; else
  // the first incomplete available lesson in curriculum order; else none.
  const flatLessons = modules.flatMap((m) => m.lessons).filter((v) => !v.held);
  const lessonRows = progress.filter((p) => flatLessons.some((v) => v.itemKey === p.item_key));
  const inProgress = lessonRows
    .filter((p) => p.status === "in_progress")
    .sort((a, b) => new Date(b.last_touched_at).getTime() - new Date(a.last_touched_at).getTime())[0];
  let resumeLesson: LessonView | null = null;
  let reason: ClassroomSummary["resume"]["reason"] = "all_done";
  if (inProgress) {
    resumeLesson = flatLessons.find((v) => v.itemKey === inProgress.item_key) ?? null;
    reason = "in_progress";
  }
  if (!resumeLesson) {
    resumeLesson = flatLessons.find((v) => v.status !== "self_checked_complete") ?? null;
    reason = resumeLesson ? "next_incomplete" : "all_done";
  }

  const lastTouchedAt = progress.reduce<string | null>(
    (latest, p) => (!latest || new Date(p.last_touched_at) > new Date(latest) ? p.last_touched_at : latest),
    null
  );

  const allAvailableComplete = availableLessons > 0 && completedLessons === availableLessons;

  return {
    modules,
    labs,
    overall: {
      availableLessons,
      completedLessons,
      heldLessons,
      percentOfAvailable: availableLessons === 0 ? 0 : Math.round((completedLessons / availableLessons) * 100),
      allAvailableComplete,
      educationFullyComplete: allAvailableComplete && heldLessons === 0,
    },
    labsCompleted: labs.filter((l) => l.status === "self_checked_complete").length,
    labsTotal: labs.length,
    resume: { lesson: resumeLesson, reason },
    lastTouchedAt,
  };
}


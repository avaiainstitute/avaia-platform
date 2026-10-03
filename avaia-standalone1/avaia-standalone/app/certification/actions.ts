"use server";

import { redirect } from "next/navigation";
import { requireClassroomCandidate } from "@/lib/certification-access";
import {
  completeLesson,
  recordItemOpened,
  reopenLesson,
  saveReflection,
  setLabStatus,
  type ClassroomResult,
} from "@/lib/certification";

// Candidate classroom actions. Each one re-verifies that the signed-in
// person is an active certification candidate and then acts only on THEIR OWN
// candidacy (the id comes from the server-side check, never from the form),
// through their own RLS-bound client. Nothing here certifies, admits, passes
// a gate, or evaluates anything: it records the candidate's own progress and
// their own words.

function lessonUrl(itemKey: string, params: Record<string, string>, hash?: string): string {
  const qs = new URLSearchParams(params).toString();
  return `/certification/lessons/${encodeURIComponent(itemKey)}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export async function saveReflectionAction(formData: FormData) {
  const itemKey = field(formData, "itemKey");
  const promptIndex = Number(field(formData, "promptIndex"));
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/lessons/${itemKey}`);
  const result = await saveReflection(supabase, candidate.id, itemKey, promptIndex, field(formData, "response"));
  const hash = `reflection-${Number.isInteger(promptIndex) ? promptIndex : 0}`;
  redirect(
    result.ok
      ? lessonUrl(itemKey, { saved: String(promptIndex) }, hash)
      : lessonUrl(itemKey, { error: result.message }, hash)
  );
}

export async function completeLessonAction(formData: FormData) {
  const itemKey = field(formData, "itemKey");
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/lessons/${itemKey}`);
  const result: ClassroomResult = await completeLesson(supabase, candidate.id, itemKey);
  redirect(result.ok ? lessonUrl(itemKey, { completed: "1" }, "lesson-complete") : lessonUrl(itemKey, { error: result.message }, "lesson-complete"));
}

export async function reopenLessonAction(formData: FormData) {
  const itemKey = field(formData, "itemKey");
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/lessons/${itemKey}`);
  await reopenLesson(supabase, candidate.id, itemKey);
  redirect(lessonUrl(itemKey, { reopened: "1" }, "lesson-complete"));
}

/** Called by the lesson/lab page when the candidate opens it, so "resume
 *  where you left off" always points at the right place. Returns quietly:
 *  failing to save a place must never block reading. */
export async function recordOpenedAction(itemKey: string): Promise<void> {
  const { supabase, candidate } = await requireClassroomCandidate(`/certification`);
  if (typeof itemKey !== "string") return;
  await recordItemOpened(supabase, candidate.id, itemKey);
}

export async function setLabStatusAction(formData: FormData) {
  const itemKey = field(formData, "itemKey");
  const status = field(formData, "status");
  const { supabase, candidate } = await requireClassroomCandidate(`/certification/labs/${itemKey}`);
  if (status !== "in_progress" && status !== "self_checked_complete") redirect(`/certification/labs/${encodeURIComponent(itemKey)}`);
  await setLabStatus(supabase, candidate.id, itemKey, status);
  redirect(`/certification/labs/${encodeURIComponent(itemKey)}?updated=1`);
}

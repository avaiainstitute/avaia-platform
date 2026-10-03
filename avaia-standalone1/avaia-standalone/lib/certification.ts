import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLessonByKey, getPracticeLabByKey, getWorkbookPrompts, isHeldItem } from "@/lib/certification-content";

// Candidate-facing certification data access: who counts as a classroom
// candidate, their self-reported progress, and their own workbook
// reflections. Every function takes the SIGNED-IN candidate's own RLS-bound
// client, so the database's row-level security (candidate = auth.uid()) is a
// second gate behind the application's own check, never the admin client.
//
// Progress here is the candidate's own record of their coursework. It is
// not evaluation, not evidence, and has no bearing on admission, the Boundary
// Gate, the Observed Practicum, or the certification decision, which remain
// human decisions recorded elsewhere (guide_candidate_evidence /
// guide_certification_decisions). Finishing every lesson never certifies
// anyone.

/** Candidacy statuses that open the classroom. paused/hold are admin
 *  decisions that put a candidacy on pause: the candidate keeps their
 *  record but is told so, rather than working in the classroom. */
export const CLASSROOM_STATUSES = ["admitted", "in_training", "development_required"];
export const RESTRICTED_STATUSES = ["paused", "hold"];

export type ActiveCandidate = {
  id: string;
  host_id: string;
  status: string;
  admitted_at: string;
};

export type CandidateAccess =
  | { kind: "none" }
  | { kind: "restricted"; candidate: ActiveCandidate }
  | { kind: "active"; candidate: ActiveCandidate };

/** Resolves what the signed-in Host's candidacy allows. A normal AVAIA
 *  account with no open candidacy gets { kind: "none" }; having an account
 *  grants nothing. Candidacies are only ever created by a human admin. */
export async function getCandidateAccess(supabase: SupabaseClient, hostId: string): Promise<CandidateAccess> {
  const { data } = await supabase
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at")
    .eq("host_id", hostId)
    .in("status", [...CLASSROOM_STATUSES, ...RESTRICTED_STATUSES])
    .order("admitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { kind: "none" };
  const candidate = data as ActiveCandidate;
  return CLASSROOM_STATUSES.includes(candidate.status) ? { kind: "active", candidate } : { kind: "restricted", candidate };
}

export async function getActiveCandidateForHost(supabase: SupabaseClient, hostId: string): Promise<ActiveCandidate | null> {
  const access = await getCandidateAccess(supabase, hostId);
  return access.kind === "active" ? access.candidate : null;
}

export async function isCertificationCandidate(supabase: SupabaseClient, hostId: string): Promise<boolean> {
  return (await getActiveCandidateForHost(supabase, hostId)) !== null;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type ProgressStatus = "not_started" | "in_progress" | "self_checked_complete";

export type CandidateProgressRow = {
  item_key: string;
  status: ProgressStatus;
  self_reported_at: string | null;
  last_touched_at: string;
};

export async function getCandidateProgress(supabase: SupabaseClient, candidateId: string): Promise<CandidateProgressRow[]> {
  const { data } = await supabase
    .from("certification_candidate_progress")
    .select("item_key, status, self_reported_at, last_touched_at")
    .eq("candidate_id", candidateId);
  return (data as CandidateProgressRow[]) ?? [];
}

export type ClassroomResult = { ok: true; message: string } | { ok: false; message: string };
const fail = (message: string): ClassroomResult => ({ ok: false, message });

async function currentRow(supabase: SupabaseClient, candidateId: string, itemKey: string) {
  const { data } = await supabase
    .from("certification_candidate_progress")
    .select("status")
    .eq("candidate_id", candidateId)
    .eq("item_key", itemKey)
    .maybeSingle();
  return (data as { status: ProgressStatus } | null) ?? null;
}

/** Records that the candidate opened an item: a not-yet-started item becomes
 *  in_progress, a completed one stays completed, and last_touched_at moves
 *  forward either way (that is what "resume where you left off" reads). */
export async function recordItemOpened(supabase: SupabaseClient, candidateId: string, itemKey: string): Promise<ClassroomResult> {
  const lesson = getLessonByKey(itemKey);
  const lab = getPracticeLabByKey(itemKey);
  if (!lesson && !lab) return fail("Unknown item.");
  if (lesson && isHeldItem(lesson)) return fail("This lesson is held and cannot be opened.");

  const now = new Date().toISOString();
  const existing = await currentRow(supabase, candidateId, itemKey);
  if (!existing) {
    const { error } = await supabase
      .from("certification_candidate_progress")
      .insert({ candidate_id: candidateId, item_key: itemKey, status: "in_progress", last_touched_at: now });
    if (error) return fail("Could not save your place.");
  } else {
    const { error } = await supabase
      .from("certification_candidate_progress")
      .update({ status: existing.status === "not_started" ? "in_progress" : existing.status, last_touched_at: now })
      .eq("candidate_id", candidateId)
      .eq("item_key", itemKey);
    if (error) return fail("Could not save your place.");
  }
  return { ok: true, message: "Saved your place." };
}

async function writeStatus(
  supabase: SupabaseClient,
  candidateId: string,
  itemKey: string,
  status: ProgressStatus
): Promise<ClassroomResult> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("certification_candidate_progress").upsert(
    {
      candidate_id: candidateId,
      item_key: itemKey,
      status,
      self_reported_at: status === "self_checked_complete" ? now : null,
      last_touched_at: now,
    },
    { onConflict: "candidate_id,item_key" }
  );
  return error ? fail("Could not save your progress.") : { ok: true, message: "Saved." };
}

/** Marks a lesson complete. Refused for a HELD lesson (it contains no
 *  finished coursework) and, where the lesson carries workbook reflection
 *  prompts, until every prompt has a saved response: the reflection is part
 *  of the lesson's work. Completion is the candidate's own record; it
 *  certifies nothing. */
export async function completeLesson(supabase: SupabaseClient, candidateId: string, itemKey: string): Promise<ClassroomResult> {
  const lesson = getLessonByKey(itemKey);
  if (!lesson) return fail("Unknown lesson.");
  if (isHeldItem(lesson)) return fail("This lesson is held pending AVAIA content and cannot be completed.");

  if (REFLECTION_REQUIRED_FOR_COMPLETION) {
    const prompts = getWorkbookPrompts(lesson);
    if (prompts.length > 0) {
      const saved = await getReflections(supabase, candidateId, itemKey);
      const missing = prompts.some((_, i) => !(saved.get(i) ?? "").trim());
      if (missing) return fail("Save a response to each reflection prompt before completing this lesson.");
    }
  }
  return writeStatus(supabase, candidateId, itemKey, "self_checked_complete");
}

export async function reopenLesson(supabase: SupabaseClient, candidateId: string, itemKey: string): Promise<ClassroomResult> {
  const lesson = getLessonByKey(itemKey);
  if (!lesson || isHeldItem(lesson)) return fail("Unknown lesson.");
  return writeStatus(supabase, candidateId, itemKey, "in_progress");
}

/** Practice Labs are partner exercises. The candidate records that they have
 *  run one; that is a self-report only. Any human sign-off on Labs is an
 *  open owner decision and is intentionally not built here. */
export async function setLabStatus(
  supabase: SupabaseClient,
  candidateId: string,
  itemKey: string,
  status: "in_progress" | "self_checked_complete"
): Promise<ClassroomResult> {
  if (!getPracticeLabByKey(itemKey)) return fail("Unknown Practice Lab.");
  return writeStatus(supabase, candidateId, itemKey, status);
}

/** Whether a lesson with workbook prompts needs those prompts answered
 *  before it can be marked complete. The curriculum authors each prompt as
 *  the lesson's own work, so this is true; it is a classroom rule about the
 *  candidate's self-reported progress only, with no effect on certification.
 *  Flagged for owner confirmation. */
export const REFLECTION_REQUIRED_FOR_COMPLETION = true;

// ---------------------------------------------------------------------------
// Candidate Workbook reflections (candidate-private; migration 0110)
// ---------------------------------------------------------------------------

export const MAX_REFLECTION_LENGTH = 10_000;

export async function getReflections(supabase: SupabaseClient, candidateId: string, itemKey: string): Promise<Map<number, string>> {
  const { data } = await supabase
    .from("certification_candidate_reflections")
    .select("prompt_index, response")
    .eq("candidate_id", candidateId)
    .eq("item_key", itemKey);
  const out = new Map<number, string>();
  for (const row of (data ?? []) as { prompt_index: number; response: string }[]) {
    out.set(row.prompt_index, row.response);
  }
  return out;
}

/** Which lessons have at least one saved reflection (keys only, never the
 *  text), so the classroom can show a "reflection saved" marker. */
export async function getLessonsWithReflections(supabase: SupabaseClient, candidateId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("certification_candidate_reflections")
    .select("item_key")
    .eq("candidate_id", candidateId);
  return new Set(((data ?? []) as { item_key: string }[]).map((r) => r.item_key));
}

export async function saveReflection(
  supabase: SupabaseClient,
  candidateId: string,
  itemKey: string,
  promptIndex: number,
  text: string
): Promise<ClassroomResult> {
  const lesson = getLessonByKey(itemKey);
  if (!lesson || isHeldItem(lesson)) return fail("Unknown lesson.");
  const prompts = getWorkbookPrompts(lesson);
  if (!Number.isInteger(promptIndex) || promptIndex < 0 || promptIndex >= prompts.length) {
    return fail("Unknown reflection prompt.");
  }
  const response = text.replace(/\r\n/g, "\n").trim();
  if (response.length > MAX_REFLECTION_LENGTH) return fail("That response is too long to save.");

  if (!response) {
    const { error } = await supabase
      .from("certification_candidate_reflections")
      .delete()
      .eq("candidate_id", candidateId)
      .eq("item_key", itemKey)
      .eq("prompt_index", promptIndex);
    return error ? fail("Could not save your response.") : { ok: true, message: "Response cleared." };
  }

  const { error } = await supabase.from("certification_candidate_reflections").upsert(
    {
      candidate_id: candidateId,
      item_key: itemKey,
      prompt_index: promptIndex,
      response,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id,item_key,prompt_index" }
  );
  if (error) return fail("Could not save your response.");

  // Saving work is activity: it keeps the lesson in progress and moves the
  // candidate's "resume here" position to it.
  await recordItemOpened(supabase, candidateId, itemKey);
  return { ok: true, message: "Response saved." };
}

// ---------------------------------------------------------------------------
// History shown to the Companion (non-evaluative events only)
// ---------------------------------------------------------------------------

export async function getCandidateNonEvaluativeHistory(
  supabase: SupabaseClient,
  candidateId: string,
  limit = 10
): Promise<{ entry_type: string; recorded_at: string }[]> {
  const { data } = await supabase
    .from("guide_candidate_history")
    .select("entry_type, recorded_at")
    .eq("candidate_id", candidateId)
    .in("entry_type", ["status_change", "certification_event"])
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return (data as { entry_type: string; recorded_at: string }[]) ?? [];
}

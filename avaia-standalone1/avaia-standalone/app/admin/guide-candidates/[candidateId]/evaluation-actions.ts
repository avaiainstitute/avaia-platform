"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  recordGateEvaluation,
  recordLabEvaluation,
  recordPracticumEvaluation,
  type LabRatingsInput,
} from "@/lib/ops/certification-evaluations";
import {
  FEEDBACK_KEYS,
  GATE_ITEM_KEYS,
  LAB_FIRST_CRITERIA,
  LAB_SECOND_CRITERIA,
  PRACTICUM_ROW_KEYS,
  type GateItemKey,
  type GateItemResult,
  type LabFirstRating,
  type LabSecondRating,
  type PracticumRating,
  type PracticumRowKey,
} from "@/lib/certification-evaluation";

// Human evaluation recording (admin only). A person evaluates; these actions
// store what the person recorded. Nothing here evaluates, scores or certifies.

async function requireAdmin(candidateId: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  if (!candidateId) redirect("/admin/guide-candidates");
  return user.id;
}

function back(candidateId: string, kind: "evalSaved" | "evalError", message: string): never {
  redirect(`/admin/guide-candidates/${candidateId}?${kind}=${encodeURIComponent(message)}#evaluations`);
}

const GATE_TITLE: Record<GateItemKey, string> = {
  ownership: "Ownership",
  privacy: "Privacy",
  scope: "Scope",
  consent: "Consent",
  safety: "Safety",
  non_diagnosis: "Non-Diagnosis",
  non_prescription: "Non-Prescription",
  capacity_boundaries: "Capacity Boundaries",
  guide_authority: "Guide Authority",
  consultation_referral: "Consultation/Referral Judgment",
};

export async function recordGateAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const actor = await requireAdmin(candidateId);
  const items: Partial<Record<GateItemKey, GateItemResult>> = {};
  for (const k of GATE_ITEM_KEYS) {
    const v = String(formData.get(`gate_${k}`) ?? "");
    if (v === "met" || v === "not_met") items[k] = v;
  }
  const result = await recordGateEvaluation({ candidateId, evaluatorId: actor, items, notes: String(formData.get("notes") ?? "").trim() });
  if (!result.ok) back(candidateId, "evalError", result.error);
  if (result.allMet) back(candidateId, "evalSaved", "Boundary Gate recorded: all ten items met.");
  const safety = result.notMet.includes("safety");
  back(
    candidateId,
    "evalSaved",
    `Boundary Gate recorded: not met on ${result.notMet.map((k) => GATE_TITLE[k]).join(", ")}. ${safety ? "Safety not met: mandatory retraining on Lesson 6.9 before reassessment. " : ""}The candidate cannot start Practice Labs until the Gate is met.`
  );
}

export async function recordLabAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const actor = await requireAdmin(candidateId);
  const ratings: LabRatingsInput = { first: {}, second: {} };
  for (const k of LAB_FIRST_CRITERIA) {
    const rating = String(formData.get(`lab_${k}`) ?? "") as LabFirstRating;
    if (rating === "demonstrated" || rating === "developing" || rating === "needs_targeted_practice") {
      ratings.first[k] = { rating, evidence: String(formData.get(`lab_${k}_evidence`) ?? "").trim() };
    }
  }
  for (const k of LAB_SECOND_CRITERIA) {
    const rating = String(formData.get(`lab_${k}`) ?? "") as LabSecondRating;
    if (rating === "demonstrated" || rating === "developing" || rating === "not_observed") ratings.second[k] = rating;
  }
  const feedback: Partial<Record<(typeof FEEDBACK_KEYS)[number], boolean>> = {};
  for (const k of FEEDBACK_KEYS) feedback[k] = formData.get(`feedback_${k}`) === "on";
  const result = await recordLabEvaluation({
    candidateId,
    labKey: String(formData.get("labKey") ?? ""),
    evaluatorId: actor,
    ratings,
    feedback,
    targetedRetryRequired: formData.get("targetedRetryRequired") === "on",
    labComplete: formData.get("labComplete") === "on",
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!result.ok) back(candidateId, "evalError", result.error);
  back(
    candidateId,
    "evalSaved",
    result.allComplete
      ? `Lab evaluation recorded. All ${result.total} Practice Labs are complete, and the Practice Lab completion evidence was written.`
      : `Lab evaluation recorded. ${result.completed} of ${result.total} Practice Labs complete.`
  );
}

export async function recordPracticumAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const actor = await requireAdmin(candidateId);
  const rows: Partial<Record<PracticumRowKey, PracticumRating>> = {};
  for (const k of PRACTICUM_ROW_KEYS) {
    const v = String(formData.get(`row_${k}`) ?? "");
    if (v === "not_yet" || v === "developing" || v === "meets") rows[k] = v;
  }
  const result = await recordPracticumEvaluation({ candidateId, evaluatorId: actor, rows, notes: String(formData.get("notes") ?? "").trim() });
  if (!result.ok) back(candidateId, "evalError", result.error);
  back(
    candidateId,
    "evalSaved",
    result.allMeets
      ? "Observed Practicum recorded: Meets on all eleven rows. Every required step now has a competent record; the certification decision is yours."
      : `Observed Practicum recorded: not yet Meets on ${result.short.length} row(s).`
  );
}

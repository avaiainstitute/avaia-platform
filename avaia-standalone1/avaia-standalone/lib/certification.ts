import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const OPEN_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required", "paused", "hold"];

export type ActiveCandidate = {
  id: string;
  host_id: string;
  status: string;
  admitted_at: string;
};

export async function getActiveCandidateForHost(
  supabase: SupabaseClient,
  hostId: string
): Promise<ActiveCandidate | null> {
  const { data } = await supabase
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at")
    .eq("host_id", hostId)
    .in("status", OPEN_CANDIDACY_STATUSES)
    .order("admitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ActiveCandidate) ?? null;
}

export async function isCertificationCandidate(supabase: SupabaseClient, hostId: string): Promise<boolean> {
  return !!(await getActiveCandidateForHost(supabase, hostId));
}

export type CandidateProgressRow = {
  item_key: string;
  status: "not_started" | "in_progress" | "self_checked_complete";
  self_reported_at: string | null;
  last_touched_at: string;
};

export async function getCandidateProgress(
  supabase: SupabaseClient,
  candidateId: string
): Promise<CandidateProgressRow[]> {
  const { data } = await supabase
    .from("certification_candidate_progress")
    .select("item_key, status, self_reported_at, last_touched_at")
    .eq("candidate_id", candidateId);
  return (data as CandidateProgressRow[]) ?? [];
}

export async function setCandidateProgress(
  supabase: SupabaseClient,
  candidateId: string,
  itemKey: string,
  status: CandidateProgressRow["status"]
): Promise<void> {
  await supabase.from("certification_candidate_progress").upsert(
    {
      candidate_id: candidateId,
      item_key: itemKey,
      status,
      self_reported_at: status === "self_checked_complete" ? new Date().toISOString() : null,
      last_touched_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id,item_key" }
  );
}

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

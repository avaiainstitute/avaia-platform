import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLASSROOM_STATUSES } from "@/lib/certification";

// Progress-aware, no-pressure check-ins to certification candidates. A
// candidate is "waiting" when their active candidacy has had no classroom
// activity (the last time they opened, saved, or completed something) for
// STALL_DAYS. Reads only timestamps from certification_candidate_progress,
// never reflection text and never evidence. Paused/held candidacies are not
// nudged. Rate limited by certification_companion_checkins.

const STALL_DAYS = Number(process.env.CERTIFICATION_COMPANION_STALL_DAYS ?? 7);
const CHECKIN_COOLDOWN_DAYS = Number(process.env.CERTIFICATION_COMPANION_CHECKIN_COOLDOWN_DAYS ?? 14);

export type CompanionWaitingCandidate = {
  candidateId: string;
  hostId: string;
  status: string;
  sinceDays: number;
};

export async function getCompanionCheckinSnapshot(): Promise<{ waiting: CompanionWaitingCandidate[] }> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: candidateRows } = await admin
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at")
    .in("status", CLASSROOM_STATUSES);
  const candidates = (candidateRows ?? []) as { id: string; host_id: string; status: string; admitted_at: string }[];

  const { data: progressRows } = await admin
    .from("certification_candidate_progress")
    .select("candidate_id, last_touched_at")
    .order("last_touched_at", { ascending: false });
  const progress = (progressRows ?? []) as { candidate_id: string; last_touched_at: string }[];

  const lastTouchByCandidate = new Map<string, string>();
  for (const row of progress) {
    if (!lastTouchByCandidate.has(row.candidate_id)) lastTouchByCandidate.set(row.candidate_id, row.last_touched_at);
  }

  const waiting: CompanionWaitingCandidate[] = [];
  for (const candidate of candidates) {
    const lastTouch = lastTouchByCandidate.get(candidate.id) ?? candidate.admitted_at;
    const ageDays = (now - new Date(lastTouch).getTime()) / 86_400_000;
    if (ageDays >= STALL_DAYS) {
      waiting.push({ candidateId: candidate.id, hostId: candidate.host_id, status: candidate.status, sinceDays: Math.floor(ageDays) });
    }
  }
  return { waiting };
}

export async function recordCompanionCheckins(
  sendFn: (item: CompanionWaitingCandidate) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  const { waiting } = await getCompanionCheckinSnapshot();

  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const item of waiting) {
    const { data: lastCheckin } = await admin
      .from("certification_companion_checkins")
      .select("sent_at")
      .eq("candidate_id", item.candidateId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastCheckin) {
      const daysSince = (Date.now() - new Date(lastCheckin.sent_at).getTime()) / 86_400_000;
      if (daysSince < CHECKIN_COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    try {
      await sendFn(item);
    } catch (err) {
      // A check-in that did not go out is never recorded as sent.
      failed += 1;
      console.error("[certification-companion] check-in send failed", {
        candidateId: item.candidateId,
        error: err instanceof Error ? err.message : err,
      });
      continue;
    }
    await admin.from("certification_companion_checkins").insert({ candidate_id: item.candidateId, checkin_type: "progress_waiting" });
    sent += 1;
  }

  return { sent, skippedCooldown, failed };
}

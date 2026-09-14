import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Automation audit finding #5.3. Watches only guardian_consents.status/
// assent_confirmed_at/consented_at -- operational metadata already read by
// lib/guardian-consent.ts's own getConsentStatusForParticipant. Never
// reads disclosure_text, guardian_name/email, or any Youth content, and
// never itself re-solicits a guardian -- it only tells the owning Guide
// that a specific participant's consent has been sitting unresolved,
// mirroring the exact same detect -> rate-limited notify shape already
// proven by lib/ops/host-onboarding.ts and lib/ops/guide-operations.ts.
// Two mechanical states, no policy invented:
//   consent_pending        -- a guardian-link consent sent, guardian
//                              hasn't confirmed yet.
//   assent_not_confirmed   -- consent is active, but the Guide hasn't yet
//                              confirmed Youth assent was delivered
//                              (see isParticipantClearedToParticipate,
//                              which requires both before a session can
//                              start).

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

export type GuardianConsentReminderType = "consent_pending" | "assent_not_confirmed";

export type GuardianConsentWaitingItem = {
  type: GuardianConsentReminderType;
  guideParticipantId: string;
  guideId: string;
  participantName: string;
  sinceDays: number;
};

export async function getGuardianConsentSnapshot(): Promise<{ waitingItems: GuardianConsentWaitingItem[] }> {
  const admin = createAdminClient();
  const now = Date.now();
  const waitingItems: GuardianConsentWaitingItem[] = [];

  const { data: consentRows } = await admin
    .from("guardian_consents")
    .select("guide_participant_id, status, assent_confirmed_at, consented_at")
    .not("guide_participant_id", "is", null)
    .in("status", ["pending", "active"]);

  const rows = (consentRows ?? []) as {
    guide_participant_id: string;
    status: string;
    assent_confirmed_at: string | null;
    consented_at: string;
  }[];
  if (rows.length === 0) return { waitingItems };

  const participantIds = Array.from(new Set(rows.map((r) => r.guide_participant_id)));
  const { data: participantRows } = await admin
    .from("guide_participants")
    .select("id, guide_id, name")
    .in("id", participantIds);
  const participantById = new Map(
    ((participantRows ?? []) as { id: string; guide_id: string; name: string }[]).map((p) => [p.id, p])
  );

  for (const row of rows) {
    const participant = participantById.get(row.guide_participant_id);
    if (!participant) continue;
    const ageDays = (now - new Date(row.consented_at).getTime()) / 86_400_000;
    if (ageDays < STALL_DAYS) continue;

    if (row.status === "pending") {
      waitingItems.push({
        type: "consent_pending",
        guideParticipantId: row.guide_participant_id,
        guideId: participant.guide_id,
        participantName: participant.name,
        sinceDays: Math.floor(ageDays),
      });
    } else if (row.status === "active" && !row.assent_confirmed_at) {
      waitingItems.push({
        type: "assent_not_confirmed",
        guideParticipantId: row.guide_participant_id,
        guideId: participant.guide_id,
        participantName: participant.name,
        sinceDays: Math.floor(ageDays),
      });
    }
  }

  return { waitingItems };
}

export async function sendGuardianConsentReminders(
  sendFn: (item: GuardianConsentWaitingItem) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  const { waitingItems } = await getGuardianConsentSnapshot();

  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const item of waitingItems) {
    const { data: lastReminder } = await admin
      .from("guardian_consent_reminders")
      .select("sent_at")
      .eq("guide_participant_id", item.guideParticipantId)
      .eq("reminder_type", item.type)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastReminder) {
      const daysSince = (Date.now() - new Date(lastReminder.sent_at).getTime()) / 86_400_000;
      if (daysSince < REMINDER_COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    // Same rule as every other reminder loop this session: only a send
    // that actually succeeds gets recorded and starts the cooldown.
    try {
      await sendFn(item);
    } catch (err) {
      failed += 1;
      console.error("[guardian-consent-reminders] send failed", {
        item,
        error: err instanceof Error ? err.message : err,
      });
      continue;
    }
    await admin.from("guardian_consent_reminders").insert({
      guide_participant_id: item.guideParticipantId,
      guide_id: item.guideId,
      reminder_type: item.type,
    });
    sent += 1;
  }

  return { sent, skippedCooldown, failed };
}

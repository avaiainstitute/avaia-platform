import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Agent 6 (AVAIA Host Onboarding), Automation Blueprint Phase 2. Reads
// exclusively from conversations.stage/status/created_at -- status and
// progress metadata only. Nothing here ever selects messages.content.

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

export type HostOnboardingState =
  | "new_host"
  | "iap_started"
  | "iap_completed"
  | "cat_eligible"
  | "cat_started"
  | "cat_completed"
  | "innercompass_started"
  | "journey_completed";

type ConversationRow = { host_id: string; stage: "iap" | "cat" | "innercompass"; status: "active" | "complete"; created_at: string };

export async function getHostOnboardingSnapshot(): Promise<{
  stateCounts: Record<HostOnboardingState, number>;
  stalledHosts: { hostId: string; stage: "iap" | "cat" | "innercompass"; sinceDays: number }[];
}> {
  const admin = createAdminClient();

  const { data: profileRows } = await admin.from("profiles").select("id, created_at");
  const { data: conversationRows } = await admin
    .from("conversations")
    .select("host_id, stage, status, created_at")
    .order("created_at", { ascending: true });

  const conversations = (conversationRows ?? []) as ConversationRow[];
  const byHost = new Map<string, ConversationRow[]>();
  for (const c of conversations) {
    const list = byHost.get(c.host_id) ?? [];
    list.push(c);
    byHost.set(c.host_id, list);
  }

  const stateCounts: Record<HostOnboardingState, number> = {
    new_host: 0,
    iap_started: 0,
    iap_completed: 0,
    cat_eligible: 0,
    cat_started: 0,
    cat_completed: 0,
    innercompass_started: 0,
    journey_completed: 0,
  };

  const stalledHosts: { hostId: string; stage: "iap" | "cat" | "innercompass"; sinceDays: number }[] = [];
  const now = Date.now();

  for (const profile of profileRows ?? []) {
    const rows = byHost.get(profile.id) ?? [];
    const hasStage = (stage: string, status?: string) =>
      rows.some((r) => r.stage === stage && (!status || r.status === status));

    let state: HostOnboardingState = "new_host";
    if (hasStage("innercompass", "complete")) state = "journey_completed";
    else if (hasStage("innercompass")) state = "innercompass_started";
    else if (hasStage("cat", "complete")) state = "cat_completed";
    else if (hasStage("cat")) state = "cat_started";
    else if (hasStage("iap", "complete")) state = "cat_eligible";
    else if (hasStage("iap")) state = "iap_started";
    stateCounts[state] += 1;

    const mostRecent = rows[rows.length - 1];
    if (mostRecent && mostRecent.status === "active") {
      const ageDays = (now - new Date(mostRecent.created_at).getTime()) / 86_400_000;
      if (ageDays >= STALL_DAYS) {
        stalledHosts.push({ hostId: profile.id, stage: mostRecent.stage, sinceDays: Math.floor(ageDays) });
      }
    }
  }

  return { stateCounts, stalledHosts };
}

type ReminderType = "iap_stalled" | "cat_eligible_no_start" | "cat_stalled" | "innercompass_stalled";

const STAGE_TO_REMINDER: Record<"iap" | "cat" | "innercompass", ReminderType> = {
  iap: "iap_stalled",
  cat: "cat_stalled",
  innercompass: "innercompass_stalled",
};

export async function sendStalledOnboardingReminders(
  sendFn: (hostId: string, reminderType: ReminderType, stage: string) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const { stalledHosts } = await getHostOnboardingSnapshot();

  let sent = 0;
  let skippedCooldown = 0;

  for (const { hostId, stage } of stalledHosts) {
    const reminderType = STAGE_TO_REMINDER[stage];

    const { data: lastReminder } = await admin
      .from("host_onboarding_reminders")
      .select("sent_at")
      .eq("host_id", hostId)
      .eq("reminder_type", reminderType)
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

    await sendFn(hostId, reminderType, stage);
    await admin.from("host_onboarding_reminders").insert({ host_id: hostId, reminder_type: reminderType });
    sent += 1;
  }

  return { sent, skippedCooldown };
}

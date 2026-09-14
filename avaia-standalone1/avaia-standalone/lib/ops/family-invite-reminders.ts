import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Automation audit finding #2.5. Uses only existing Family Membership
// data and rules (lib/family-membership.ts) -- no new status, no new
// expiration concept invented. A family_members row has exactly three
// possible statuses today: 'invited', 'active', 'removed'. This watches
// only 'invited' rows belonging to a still-active plan; the moment a row
// leaves 'invited' (accepted -> 'active', or ever removed -> 'removed',
// however that eventually happens) it simply stops matching this query on
// the next run -- no separate "stop reminding" logic is needed, the same
// idempotent-detection shape every other reminder in this codebase
// already uses.

const STALL_DAYS = Number(process.env.ONBOARDING_STALL_DAYS ?? 4);
const REMINDER_COOLDOWN_DAYS = Number(process.env.ONBOARDING_REMINDER_COOLDOWN_DAYS ?? 14);

export type StalledFamilyInvite = {
  familyMemberId: string;
  invitedEmail: string;
  inviteToken: string;
  isExtraSeat: boolean;
  sinceDays: number;
};

export async function getStalledFamilyInvites(): Promise<{ stalled: StalledFamilyInvite[] }> {
  const admin = createAdminClient();
  const now = Date.now();

  const { data: activePlans } = await admin.from("family_memberships").select("id").eq("status", "active");
  const activePlanIds = (activePlans ?? []).map((p: { id: string }) => p.id);
  if (activePlanIds.length === 0) return { stalled: [] };

  const { data: invitedRows } = await admin
    .from("family_members")
    .select("id, invited_email, invite_token, is_extra_seat, invited_at, family_membership_id")
    .eq("status", "invited")
    .in("family_membership_id", activePlanIds);

  const stalled: StalledFamilyInvite[] = [];
  for (const row of (invitedRows ?? []) as {
    id: string;
    invited_email: string;
    invite_token: string | null;
    is_extra_seat: boolean;
    invited_at: string;
  }[]) {
    if (!row.invite_token) continue; // defensive only; every 'invited' row always has one
    const ageDays = (now - new Date(row.invited_at).getTime()) / 86_400_000;
    if (ageDays < STALL_DAYS) continue;
    stalled.push({
      familyMemberId: row.id,
      invitedEmail: row.invited_email,
      inviteToken: row.invite_token,
      isExtraSeat: row.is_extra_seat,
      sinceDays: Math.floor(ageDays),
    });
  }

  return { stalled };
}

export async function sendFamilyInviteReminders(
  sendFn: (invite: StalledFamilyInvite) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  const { stalled } = await getStalledFamilyInvites();

  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const invite of stalled) {
    const { data: lastReminder } = await admin
      .from("family_invite_reminders")
      .select("sent_at")
      .eq("family_member_id", invite.familyMemberId)
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
      await sendFn(invite);
    } catch (err) {
      failed += 1;
      console.error("[family-invite-reminders] send failed", {
        invite,
        error: err instanceof Error ? err.message : err,
      });
      continue;
    }
    await admin.from("family_invite_reminders").insert({ family_member_id: invite.familyMemberId });
    sent += 1;
  }

  return { sent, skippedCooldown, failed };
}

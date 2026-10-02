import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_REGISTRY, type ToolKey } from "@/lib/toolkit";
import {
  type ToolkitSupportItem,
  type SupportCategory,
  type SupportState,
  type ToolkitHealthIssue,
  checkToolkitRegistryHealth,
  requiresHumanApproval,
  summarizeToolkitStewardship,
  founderDigestWorthyToolkitItems,
  type ToolkitStewardshipSummary,
} from "@/lib/toolkit-stewardship";

// Toolkit Stewardship Agent -- admin-client I/O layer over the pure
// resolver in lib/toolkit-stewardship.ts. Mirrors lib/ops/certification-operations.ts's
// own shape: one batched read, pure-function derivation, cooldown-gated
// cron notification. Never writes a judgment -- "resolution" is only ever
// set by a human through the admin surface (recordToolkitSupportResolution).

const COOLDOWN_DAYS = Number(process.env.TOOLKIT_STEWARDSHIP_COOLDOWN_DAYS ?? 3);

type ItemRow = {
  id: string;
  host_id: string;
  tool_key: ToolKey;
  category: SupportCategory;
  description: string;
  affected_resource: string | null;
  current_version_or_status: string | null;
  state: SupportState;
  requires_human_approval: boolean;
  assigned_to: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: ItemRow, nameByHostId: Map<string, string | null>): ToolkitSupportItem {
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: nameByHostId.get(row.host_id) ?? null,
    toolKey: row.tool_key,
    category: row.category,
    description: row.description,
    affectedResource: row.affected_resource,
    currentVersionOrStatus: row.current_version_or_status,
    state: row.state,
    requiresHumanApproval: row.requires_human_approval,
    assignedTo: row.assigned_to,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Routes that genuinely resolve today, per the last repository audit
 *  (see the Mobile V2 / automation final reports). This is a static,
 *  human-auditable snapshot of app/toolkit's own directory structure --
 *  never a live filesystem probe (not reliable from a serverless
 *  function), and never a source of truth beyond "did a route exist the
 *  last time a human checked." Re-verify by re-running the audit, not by
 *  editing TOOL_REGISTRY from here. */
const LIVE_ROUTE_EXISTS: Partial<Record<ToolKey, boolean>> = {
  preparation: true,
  "secondary-loss": true,
  chemistry: true,
  give: true,
  "defying-grief": true,
  "unsung-heroes": true,
  library: true,
};

export async function getAllToolkitSupportItems(): Promise<ToolkitSupportItem[]> {
  const admin = createAdminClient();
  const { data: itemRows } = await admin
    .from("toolkit_support_items")
    .select(
      "id, host_id, tool_key, category, description, affected_resource, current_version_or_status, state, requires_human_approval, assigned_to, resolution, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  const rows = (itemRows ?? []) as ItemRow[];
  const hostIds = Array.from(new Set(rows.map((r) => r.host_id)));
  const { data: profileRows } = hostIds.length
    ? await admin.from("profiles").select("id, guide_display_name").in("id", hostIds)
    : { data: [] as { id: string; guide_display_name: string | null }[] };
  const nameByHostId = new Map((profileRows ?? []).map((p) => [p.id, p.guide_display_name]));

  return rows.map((r) => toItem(r, nameByHostId));
}

export function getToolkitRegistryHealth(): ToolkitHealthIssue[] {
  return checkToolkitRegistryHealth(LIVE_ROUTE_EXISTS);
}

export async function getToolkitStewardshipSummary(): Promise<{
  summary: ToolkitStewardshipSummary;
  items: ToolkitSupportItem[];
}> {
  const items = await getAllToolkitSupportItems();
  const healthIssues = getToolkitRegistryHealth();
  return { summary: summarizeToolkitStewardship(items, healthIssues), items };
}

/** A Guide submits a support item about a Toolkit resource -- insert-only
 *  self, mirroring the table's own RLS ("toolkit support self insert").
 *  category/requiresHumanApproval are computed here from the established
 *  vocabulary, never left to client input to decide approval routing. */
export async function submitToolkitSupportItem(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  args: { hostId: string; toolKey: ToolKey; category: SupportCategory; description: string; affectedResource?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const def = TOOL_REGISTRY.find((t) => t.key === args.toolKey);
  if (!def) return { ok: false, error: "Unknown Toolkit item." };
  if (!args.description.trim()) return { ok: false, error: "Description is required." };

  const { data, error } = await supabase
    .from("toolkit_support_items")
    .insert({
      host_id: args.hostId,
      tool_key: args.toolKey,
      category: args.category,
      description: args.description.trim(),
      affected_resource: args.affectedResource ?? null,
      current_version_or_status: def.status,
      state: "open",
      requires_human_approval: requiresHumanApproval(args.category),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not record this item." };
  return { ok: true, id: data.id as string };
}

/** A Guide's own items, self-select RLS already enforces this is their own
 *  rows only -- this just shapes them into the Guide-facing view. */
export async function getGuideFacingToolkitItems(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  hostId: string
) {
  const { toGuideFacingSupportView } = await import("@/lib/toolkit-stewardship");
  const { data } = await supabase
    .from("toolkit_support_items")
    .select(
      "id, host_id, tool_key, category, description, affected_resource, current_version_or_status, state, requires_human_approval, assigned_to, resolution, created_at, updated_at"
    )
    .eq("host_id", hostId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as ItemRow[]).map((r) => toGuideFacingSupportView(toItem(r, new Map())));
}

/** Admin-only resolution write -- the one place "resolution" text is ever
 *  stored, and only from a human-submitted string, never generated here. */
export async function recordToolkitSupportResolution(args: {
  itemId: string;
  state: SupportState;
  resolution?: string | null;
  assignedTo?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("toolkit_support_items")
    .update({
      state: args.state,
      resolution: args.resolution ?? null,
      assigned_to: args.assignedTo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.itemId);
}

export type ToolkitStewardshipNotification = {
  itemId: string;
  hostId: string;
  toolKey: ToolKey;
  category: SupportCategory;
  description: string;
};

/** Daily cron body -- same cooldown/idempotency shape as
 *  recordCertificationOperationsExceptions: one toolkit_support_reminders
 *  row per item per notification, never repeated inside COOLDOWN_DAYS.
 *  Only ever notifies admin/ops (see the cron route), never the Guide who
 *  filed the item. */
export async function recordToolkitStewardshipReminders(
  sendFn: (n: ToolkitStewardshipNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const { items, summary } = await getToolkitStewardshipSummary();

  let sent = 0;
  let skippedCooldown = 0;

  const needsAttention = items.filter(
    (i) => i.state === "open" || i.state === "awaiting_human" || i.category === "POLICY_REQUIRED"
  );

  for (const item of needsAttention) {
    const { data: lastRow } = await admin
      .from("toolkit_support_reminders")
      .select("sent_at")
      .eq("item_id", item.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRow) {
      const daysSince = (Date.now() - new Date(lastRow.sent_at).getTime()) / 86_400_000;
      if (daysSince < COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    await sendFn({ itemId: item.id, hostId: item.hostId, toolKey: item.toolKey, category: item.category, description: item.description });
    await admin.from("toolkit_support_reminders").insert({ item_id: item.id, reminder_type: "awaiting_human_reminder" });
    sent += 1;
  }

  // Recurring-pattern / health-issue visibility doesn't need its own
  // per-item reminder row -- it's surfaced to Founder Digest directly via
  // founderDigestWorthyToolkitItems, computed fresh each run from summary.
  void summary;

  return { sent, skippedCooldown };
}

export { founderDigestWorthyToolkitItems };

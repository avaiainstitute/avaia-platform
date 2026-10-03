import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOL_REGISTRY, toolLabel, type ToolKey } from "@/lib/toolkit";
import {
  checkToolkitRegistryHealth,
  detectRecurringToolkitPatterns,
  requiresHumanApproval,
  toGuideFacingSupportView,
  type SupportCategory,
  type SupportState,
  type ToolkitHealthIssue,
  type ToolkitSupportItem,
} from "@/lib/toolkit-stewardship";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// TOOLKIT STEWARDSHIP, as an operational capability. Once Guide access exists,
// this is what keeps the Toolkit itself current, complete, understandable and
// working:
//   * a certified Guide reports a problem or makes a request from the Toolkit
//     (app/toolkit/support), and sees the status and the human-written resolution;
//   * a plain question the registry can answer is answered on the spot and never
//     becomes a ticket; anything else becomes one item;
//   * the registry is probed live, so a tool marked installed whose page is gone
//     (or a "not installed" tool whose page now exists) is reported;
//   * what needs a person goes to What Needs Dorian: an adaptation, addition or
//     policy item is a DECISION (nothing here ever approves one or invents a
//     policy); a problem report or question is a reply a person owes; a broken
//     route is a problem; recurring reports are visibility.
// "Resolution" text is only ever written by a person (app/admin/toolkit-support).

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

const ITEM_COLUMNS =
  "id, host_id, tool_key, category, description, affected_resource, current_version_or_status, state, requires_human_approval, assigned_to, resolution, created_at, updated_at";

function toItem(r: ItemRow): ToolkitSupportItem {
  return {
    id: r.id,
    hostId: r.host_id,
    hostName: null,
    toolKey: r.tool_key,
    category: r.category,
    description: r.description,
    affectedResource: r.affected_resource,
    currentVersionOrStatus: r.current_version_or_status,
    state: r.state,
    requiresHumanApproval: r.requires_human_approval,
    assignedTo: r.assigned_to,
    resolution: r.resolution,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getAllToolkitSupportItems(): Promise<ToolkitSupportItem[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("toolkit_support_items").select(ITEM_COLUMNS).order("created_at", { ascending: false });
  return ((data ?? []) as ItemRow[]).map(toItem);
}

// ---------------------------------------------------------------------------
// Live registry health: does each tool's page actually resolve?
// ---------------------------------------------------------------------------

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.avaiainstitute.com";

/** A real request per tool page, without following redirects: a signed-out request
 *  to a Toolkit page redirects to sign-in (the page exists); only a 404 means the
 *  page is gone. No content is read. */
export async function probeToolkitRoutes(): Promise<Partial<Record<ToolKey, boolean>>> {
  const out: Partial<Record<ToolKey, boolean>> = {};
  await Promise.all(
    TOOL_REGISTRY.filter((t) => t.href).map(async (t) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`${SITE}${t.href}`, { redirect: "manual", signal: controller.signal, cache: "no-store" });
        out[t.key] = res.status !== 404;
      } catch {
        // Unreachable is not evidence the page is missing; leave it undecided.
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return out;
}

export async function getToolkitRegistryHealth(): Promise<ToolkitHealthIssue[]> {
  return checkToolkitRegistryHealth(await probeToolkitRoutes());
}

// ---------------------------------------------------------------------------
// Guide-facing: report or request, and see your own items
// ---------------------------------------------------------------------------

/** A Guide files an item about a Toolkit resource: insert-only-self, mirroring the
 *  table's own RLS. Whether it needs a human decision is computed here from the
 *  category, never left to the client. */
export async function submitToolkitSupportItem(
  supabase: SupabaseClient,
  args: { hostId: string; toolKey: ToolKey; category: SupportCategory; description: string; affectedResource?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const def = TOOL_REGISTRY.find((t) => t.key === args.toolKey);
  if (!def) return { ok: false, error: "Unknown Toolkit item." };
  if (!args.description.trim()) return { ok: false, error: "Please describe what you need." };

  const { data, error } = await supabase
    .from("toolkit_support_items")
    .insert({
      host_id: args.hostId,
      tool_key: args.toolKey,
      category: args.category,
      description: args.description.trim().slice(0, 4000),
      affected_resource: args.affectedResource ?? null,
      current_version_or_status: def.status,
      state: "open",
      requires_human_approval: requiresHumanApproval(args.category),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not record this." };
  return { ok: true, id: data.id as string };
}

/** A Guide's own items (self-read RLS already limits this to their rows), shaped into
 *  the Guide-facing view: status and the written resolution, never assignee or routing notes. */
export async function getGuideFacingToolkitItems(supabase: SupabaseClient, hostId: string) {
  const { data } = await supabase.from("toolkit_support_items").select(ITEM_COLUMNS).eq("host_id", hostId).order("created_at", { ascending: false });
  return ((data ?? []) as ItemRow[]).map((r) => toGuideFacingSupportView(toItem(r)));
}

/** Admin-only: the one place "resolution" is ever written, and only from a
 *  person's own text. */
export async function recordToolkitSupportResolution(args: { itemId: string; state: SupportState; resolution?: string | null }): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("toolkit_support_items")
    .update({ state: args.state, resolution: args.resolution?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", args.itemId);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// The capability
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<SupportCategory, string> = {
  SUPPORT: "asked for support with",
  BUG: "reported a problem with",
  MISSING_ASSET: "reported something missing from",
  VERSION: "asked about the version of",
  CLARIFICATION: "asked a question the Toolkit could not answer about",
  ADAPTATION_REQUEST: "requested an adaptation of",
  ADDITION_REQUEST: "requested an addition to",
  AUTHORIZATION_QUESTION: "asked an authorization question about",
  POLICY_REQUIRED: "raised something needing an AVAIA policy decision about",
};

const isOpen = (i: ToolkitSupportItem) => i.state !== "resolved" && i.state !== "closed";

/** Pure: turns items and registry health into the capability result. */
export function classifyToolkitStewardship(
  items: ToolkitSupportItem[],
  healthIssues: ToolkitHealthIssue[],
  label: (hostId: string) => string
): CapabilityResult {
  const decisions: NeedsItem[] = [];
  const people: NeedsItem[] = [];
  const problems: NeedsItem[] = [];
  const watching: NeedsItem[] = [];

  for (const item of items.filter(isOpen)) {
    const text = `${label(item.hostId)} ${CATEGORY_LABEL[item.category]} ${toolLabel(item.toolKey)}: ${item.description.slice(0, 200)}`;
    const entry: NeedsItem = { key: `toolkit:item:${item.id}`, text, href: "/admin/toolkit-support" };
    // Adaptation, addition and policy items need an AVAIA decision no automation may make.
    if (item.requiresHumanApproval) decisions.push(entry);
    else people.push(entry);
  }

  for (const issue of healthIssues) {
    problems.push({ key: `toolkit:health:${issue.toolKey}:${issue.kind}`, text: `Toolkit health: ${issue.detail}`, href: "/admin/toolkit-support" });
  }

  for (const p of detectRecurringToolkitPatterns(items)) {
    watching.push({
      key: `toolkit:pattern:${p.toolKey}:${p.category}`,
      text: `Recurring: ${p.count} open ${CATEGORY_LABEL[p.category]} ${toolLabel(p.toolKey)} reports (several Guides hitting the same thing is worth fixing at the source).`,
      href: "/admin/toolkit-support",
    });
  }

  return {
    key: "toolkit_stewardship",
    label: "Toolkit Stewardship",
    evaluated: items.length + TOOL_REGISTRY.length,
    decisions,
    people,
    problems,
    watching,
  };
}

export async function evaluateToolkitStewardship(): Promise<CapabilityResult> {
  const [items, health] = await Promise.all([getAllToolkitSupportItems(), getToolkitRegistryHealth()]);
  const label = await hostLabels(items.filter(isOpen).slice(0, 30).map((i) => i.hostId));
  return classifyToolkitStewardship(items, health, label);
}

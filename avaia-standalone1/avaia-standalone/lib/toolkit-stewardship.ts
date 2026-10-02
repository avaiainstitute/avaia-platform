/**
 * The AVAIA Toolkit Stewardship Agent -- pure, deterministic resolver.
 * Audited against the current repository and live schema before writing
 * anything here (see the final report for the full audit): lib/toolkit.ts's
 * TOOL_REGISTRY is static code, not a versioned DB record, and no
 * feedback/support/ticket infrastructure of any kind existed anywhere in
 * this schema before 0108_toolkit_stewardship.sql.
 *
 * GOVERNING ROLE enforced throughout this file: Guide Operations answers
 * "should this Guide have access"; Program Operations answers "is this
 * Guide authorized for this program"; this file only ever answers "once
 * access exists, is the Toolkit itself current, complete, understandable,
 * accessible, and functioning." Every exported function here supports,
 * monitors, organizes, detects, or routes -- none of them ever approve an
 * ADAPTATION_REQUEST or ADDITION_REQUEST, grant a new use, or invent a
 * policy. "resolution" text is only ever written by a human through the
 * admin surface; nothing here infers one.
 */

import { TOOL_REGISTRY, type ToolKey, toolLabel } from "@/lib/toolkit";

export const SUPPORT_CATEGORIES = [
  "SUPPORT",
  "BUG",
  "MISSING_ASSET",
  "VERSION",
  "CLARIFICATION",
  "ADAPTATION_REQUEST",
  "ADDITION_REQUEST",
  "AUTHORIZATION_QUESTION",
  "POLICY_REQUIRED",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATES = ["open", "in_review", "awaiting_human", "resolved", "closed"] as const;
export type SupportState = (typeof SUPPORT_STATES)[number];

/** Categories that can never be auto-resolved -- they require an AVAIA
 *  policy/content decision no automation may make. */
export const HUMAN_APPROVAL_REQUIRED_CATEGORIES: SupportCategory[] = [
  "ADAPTATION_REQUEST",
  "ADDITION_REQUEST",
  "POLICY_REQUIRED",
];

export function requiresHumanApproval(category: SupportCategory): boolean {
  return HUMAN_APPROVAL_REQUIRED_CATEGORIES.includes(category);
}

export type ToolkitSupportItem = {
  id: string;
  hostId: string;
  hostName: string | null;
  toolKey: ToolKey;
  category: SupportCategory;
  description: string;
  affectedResource: string | null;
  currentVersionOrStatus: string | null;
  state: SupportState;
  requiresHumanApproval: boolean;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Guide-facing view: a Guide may see their own item's status and
 *  resolution text, never assignee identity or internal routing notes. */
export type GuideFacingSupportView = {
  id: string;
  toolKey: ToolKey;
  toolLabel: string;
  category: SupportCategory;
  description: string;
  state: SupportState;
  resolution: string | null;
  createdAt: string;
};

export function toGuideFacingSupportView(item: ToolkitSupportItem): GuideFacingSupportView {
  return {
    id: item.id,
    toolKey: item.toolKey,
    toolLabel: toolLabel(item.toolKey),
    category: item.category,
    description: item.description,
    state: item.state,
    resolution: item.state === "resolved" || item.state === "closed" ? item.resolution : null,
    createdAt: item.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Routine Guide support -- answer only from what the current registry
// actually states. Never invents a new AVAIA use, adaptation, Experience,
// policy, or authorization: every returned answer is a direct read of
// TOOL_REGISTRY's own fields, or "I don't have that on file" when it isn't.
// ---------------------------------------------------------------------------

export type RoutineSupportAnswer =
  | { kind: "answered"; text: string }
  | { kind: "not_on_file"; suggestedCategory: SupportCategory };

export function answerRoutineToolkitQuestion(toolKey: ToolKey): RoutineSupportAnswer {
  const def = TOOL_REGISTRY.find((t) => t.key === toolKey);
  if (!def) return { kind: "not_on_file", suggestedCategory: "CLARIFICATION" };
  const parts: string[] = [`${def.label}: status is "${def.status}".`];
  if (def.href) parts.push(`Resource: ${def.href}.`);
  else parts.push("No standalone route is published for this item yet.");
  if (def.description) parts.push(def.description);
  return { kind: "answered", text: parts.join(" ") };
}

// ---------------------------------------------------------------------------
// Toolkit health monitoring -- pure checks over a snapshot the ops layer
// assembles (registry vs. what actually resolves). Never infers that
// something is approved merely because a route or file exists; only
// compares the registry's own declared status against a liveness probe the
// ops layer performs, and reports a mismatch for a human to resolve.
// ---------------------------------------------------------------------------

export type ToolkitHealthIssue = {
  toolKey: ToolKey;
  kind:
    | "marked_installed_but_route_missing"
    | "marked_unavailable_but_route_now_exists"
    | "no_href_for_installed_tool";
  detail: string;
};

export function checkToolkitRegistryHealth(
  liveRouteExists: Partial<Record<ToolKey, boolean>>
): ToolkitHealthIssue[] {
  const issues: ToolkitHealthIssue[] = [];
  for (const def of TOOL_REGISTRY) {
    const exists = liveRouteExists[def.key];
    if (def.status === "installed" && def.href && exists === false) {
      issues.push({
        toolKey: def.key,
        kind: "marked_installed_but_route_missing",
        detail: `${def.label} is marked installed with route ${def.href}, but that route did not resolve.`,
      });
    }
    if (def.status === "installed" && !def.href) {
      issues.push({
        toolKey: def.key,
        kind: "no_href_for_installed_tool",
        detail: `${def.label} is marked installed but has no route configured.`,
      });
    }
    if (def.status === "specified-not-installed" && exists === true) {
      issues.push({
        toolKey: def.key,
        kind: "marked_unavailable_but_route_now_exists",
        detail: `${def.label} is marked specified-not-installed, but a working route now exists -- registry may be stale.`,
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Pattern detection -- computed live over a window of items, never
// persisted into a separate table (so it stays combinable into a future
// owner console rather than a bespoke reporting structure).
// ---------------------------------------------------------------------------

export type ToolkitPattern = {
  toolKey: ToolKey;
  category: SupportCategory;
  count: number;
  itemIds: string[];
};

export function detectRecurringToolkitPatterns(
  items: ToolkitSupportItem[],
  minCount = 3
): ToolkitPattern[] {
  const groups = new Map<string, ToolkitPattern>();
  for (const item of items) {
    if (item.state === "resolved" || item.state === "closed") continue;
    const key = `${item.toolKey}::${item.category}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.itemIds.push(item.id);
    } else {
      groups.set(key, { toolKey: item.toolKey, category: item.category, count: 1, itemIds: [item.id] });
    }
  }
  return Array.from(groups.values())
    .filter((p) => p.count >= minCount)
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Admin summary -- exceptions-first. Healthy (resolved/closed) items are
// summarized to a count, never individually paraded.
// ---------------------------------------------------------------------------

export type ToolkitStewardshipSummary = {
  open: number;
  inReview: number;
  awaitingHuman: number;
  byCategory: Record<SupportCategory, number>;
  healthyResolved: number;
  recurringPatterns: ToolkitPattern[];
  healthIssues: ToolkitHealthIssue[];
  policyRequired: ToolkitSupportItem[];
  addsAndAdaptationsAwaitingHuman: ToolkitSupportItem[];
};

export function summarizeToolkitStewardship(
  items: ToolkitSupportItem[],
  healthIssues: ToolkitHealthIssue[]
): ToolkitStewardshipSummary {
  const byCategory = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c, 0])) as Record<
    SupportCategory,
    number
  >;
  let open = 0;
  let inReview = 0;
  let awaitingHuman = 0;
  let healthyResolved = 0;
  const policyRequired: ToolkitSupportItem[] = [];
  const addsAndAdaptationsAwaitingHuman: ToolkitSupportItem[] = [];

  for (const item of items) {
    byCategory[item.category] += 1;
    if (item.state === "open") open += 1;
    if (item.state === "in_review") inReview += 1;
    if (item.state === "awaiting_human") {
      awaitingHuman += 1;
      if (item.category === "ADAPTATION_REQUEST" || item.category === "ADDITION_REQUEST") {
        addsAndAdaptationsAwaitingHuman.push(item);
      }
    }
    if (item.state === "resolved" || item.state === "closed") healthyResolved += 1;
    if (item.category === "POLICY_REQUIRED" && item.state !== "resolved" && item.state !== "closed") {
      policyRequired.push(item);
    }
  }

  return {
    open,
    inReview,
    awaitingHuman,
    byCategory,
    healthyResolved,
    recurringPatterns: detectRecurringToolkitPatterns(items),
    healthIssues,
    policyRequired,
    addsAndAdaptationsAwaitingHuman,
  };
}

/** What (if anything) belongs on the Founder Digest -- deliberately a tiny
 *  subset of the full summary (item 10: do not flood Founder Digest with
 *  ordinary support tickets). */
export function founderDigestWorthyToolkitItems(summary: ToolkitStewardshipSummary): string[] {
  const lines: string[] = [];
  if (summary.policyRequired.length > 0) {
    lines.push(`${summary.policyRequired.length} Toolkit item(s) require an AVAIA policy decision.`);
  }
  if (summary.addsAndAdaptationsAwaitingHuman.length > 0) {
    lines.push(
      `${summary.addsAndAdaptationsAwaitingHuman.length} adaptation/addition request(s) awaiting human decision.`
    );
  }
  if (summary.recurringPatterns.length > 0) {
    for (const p of summary.recurringPatterns.slice(0, 5)) {
      lines.push(`Recurring: ${p.count}x ${p.category} on ${toolLabel(p.toolKey)}.`);
    }
  }
  if (summary.healthIssues.length > 0) {
    lines.push(`${summary.healthIssues.length} Toolkit health issue(s) detected (broken/stale routes).`);
  }
  return lines;
}

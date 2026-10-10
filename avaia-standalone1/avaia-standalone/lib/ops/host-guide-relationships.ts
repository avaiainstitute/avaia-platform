import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentScope, grantStatus } from "@/lib/coordination-guide";
import { guideNames, listGrants, listScope } from "@/lib/ops/coordination-guide";

// THE HOST'S VIEW OF THEIR CURRENT GUIDE RELATIONSHIPS. Visibility for the Host, not new authority: it reads only what the Host has already
// granted (guide_journey_access and coordination_guide_grants, both Host-owned and readable by the Host under their existing RLS) and grants
// nothing, widens nothing and stores nothing. It shows the Guide's display name (never an email), what kind of access is active, when it
// began, when it ends where it has an end, and how much of the Host's own coordination material is in scope (a count, never the content).
// It never reads a Guide's notes, follow-up marks or anything else that belongs to the Guide.
//
// Fields deliberately omitted because the existing data does not support them: Guided Journey access has no end date (it lasts until the Host
// revokes it), so none is shown; and there is no separate "relationship status" beyond active or ended, so only that is shown.

export type HostGuideRelationship = {
  key: string;
  kind: "journey" | "coordination";
  guideName: string;
  accessLabel: string;
  statusLabel: string;
  since: string;
  /** null when this kind of access has no end date. */
  endsOn: string | null;
  detail: string;
};

export async function loadHostGuideRelationships(supabase: SupabaseClient, hostId: string): Promise<HostGuideRelationship[]> {
  const rows: HostGuideRelationship[] = [];
  const guideIds: string[] = [];

  const { data: journeyAccess } = await supabase
    .from("guide_journey_access")
    .select("id, journey_id, guide_id, granted_at")
    .eq("host_id", hostId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  const access = journeyAccess ?? [];
  guideIds.push(...access.map((a) => a.guide_id));

  let grants: Awaited<ReturnType<typeof listGrants>> = [];
  let scope: Awaited<ReturnType<typeof listScope>> = [];
  try {
    grants = (await listGrants(supabase, hostId)).filter((g) => grantStatus(g) === "active");
    scope = await listScope(supabase, hostId);
  } catch {
    // The coordination tables not answering must never take the rest of the Workbook down; that kind of access is simply not listed.
    grants = [];
  }
  guideIds.push(...grants.map((g) => g.guide_id));

  const names = await guideNames(supabase, guideIds);

  const journeyIds = access.map((a) => a.journey_id);
  const startedById = new Map<string, string>();
  if (journeyIds.length > 0) {
    const { data: journeys } = await supabase.from("journeys").select("id, started_at").in("id", journeyIds);
    for (const j of journeys ?? []) if (j.started_at) startedById.set(j.id, j.started_at);
  }

  for (const a of access) {
    const started = startedById.get(a.journey_id);
    rows.push({
      key: `journey-${a.id}`,
      kind: "journey",
      guideName: names.get(a.guide_id) ?? "Your Guide",
      accessLabel: "Guided Journey",
      statusLabel: "Active",
      since: a.granted_at,
      endsOn: null,
      detail: `Permission to facilitate your Journey${started ? ` that began ${new Date(started).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}` : ""}. It has no end date and lasts until you revoke it. It does not transfer ownership of your Journey, story, or decisions.`,
    });
  }

  for (const g of grants) {
    const s = currentScope(scope, g.id);
    rows.push({
      key: `coordination-${g.id}`,
      kind: "coordination",
      guideName: names.get(g.guide_id) ?? "Your Guide",
      accessLabel: "Guide Coordination",
      statusLabel: "Active",
      since: g.granted_at,
      endsOn: g.ends_at,
      detail: `A read-only view of ${s.itemIds.size} coordination item${s.itemIds.size === 1 ? "" : "s"} and ${s.entryIds.size} continuity entr${s.entryIds.size === 1 ? "y" : "ies"} that you chose. This Guide can add notes and follow-up marks; they cannot change anything you own.`,
    });
  }

  return rows;
}
